package expo.modules.diagnostics

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.system.Os
import android.system.OsConstants
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.InputStream

// Reads OS-recorded process-exit records and maps them to the shared NativeDiagnostic
// shape. API 30+ only. Peek/ack protocol: drain() returns records without consuming
// them; the cursor advances only when JS calls ack() after durably persisting the
// entries, so a crash in between replays the records instead of losing them.
class ExpoDiagnosticsModule : Module() {
  private val prefsName = "expo_diagnostics"
  private val cursorKey = "last_exit_ts"
  private val detailCap = 64 * 1024
  // Upper bound on a single trace read; tombstones with memory dumps run to ~1MB.
  private val maxTraceBytes = 2 * 1024 * 1024

  override fun definition() = ModuleDefinition {
    Name("ExpoDiagnostics")

    AsyncFunction("drain") {
      drain()
    }

    AsyncFunction("ack") { tokens: List<String> ->
      ack(tokens)
    }

    // Raise a real SIGSEGV so debuggerd writes a tombstone and the next launch sees
    // REASON_CRASH_NATIVE — exercises the TombstoneParser path end-to-end. (A JVM
    // throw would record plain REASON_CRASH, which has no tombstone.)
    Function("testNativeCrash") {
      Os.kill(Process.myPid(), OsConstants.SIGSEGV)
    }

    // Block the main thread past the input-dispatch timeout to record REASON_ANR.
    Function("testAnr") {
      Handler(Looper.getMainLooper()).post {
        Thread.sleep(10_000)
      }
    }
  }

  private fun prefs(): SharedPreferences? =
    appContext.reactContext?.getSharedPreferences(prefsName, Context.MODE_PRIVATE)

  private fun drain(): List<Map<String, Any?>> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return emptyList()

    val context = appContext.reactContext ?: return emptyList()
    val am = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
      ?: return emptyList()
    val prefs = prefs() ?: return emptyList()
    // maxNum=0 returns every retained record, so a backlog larger than one page
    // cannot slip past the cursor unseen.
    val records = am.getHistoricalProcessExitReasons(context.packageName, 0, 0)

    // First run (no cursor yet): seed to the newest existing exit and report nothing, so
    // pre-install / pre-update history is not replayed as fresh crashes.
    if (!prefs.contains(cursorKey)) {
      val newest = records.maxOfOrNull { it.timestamp } ?: 0L
      prefs.edit().putLong(cursorKey, newest).apply()
      return emptyList()
    }

    val cursor = prefs.getLong(cursorKey, 0L)
    val out = ArrayList<Map<String, Any?>>()
    for (info in records) {
      if (info.timestamp <= cursor) continue
      val kind = mapReason(info) ?: continue
      out.add(toEntry(info, kind))
    }
    return out
  }

  // Advance the cursor past every acknowledged record. Tokens are the entries'
  // exit timestamps as strings.
  private fun ack(tokens: List<String>) {
    val prefs = prefs() ?: return
    val maxTs = tokens.mapNotNull { it.toLongOrNull() }.maxOrNull() ?: return
    if (maxTs > prefs.getLong(cursorKey, 0L)) {
      prefs.edit().putLong(cursorKey, maxTs).apply()
    }
  }

  private fun mapReason(info: ApplicationExitInfo): String? = when (info.reason) {
    ApplicationExitInfo.REASON_CRASH -> "crash"
    ApplicationExitInfo.REASON_CRASH_NATIVE -> "crash"
    // The process died before it could run — user-visible failure, not benign.
    ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "crash"
    ApplicationExitInfo.REASON_ANR -> "anr"
    ApplicationExitInfo.REASON_LOW_MEMORY -> "memory"
    // Devices without LMK-death reporting surface low-memory kills as SIGKILL.
    ApplicationExitInfo.REASON_SIGNALED ->
      if (info.status == OsConstants.SIGKILL) "memory" else "other"
    ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "other"
    else -> null // ignore benign exits (user requested, exit self, dependency died, etc.)
  }

  private fun toEntry(info: ApplicationExitInfo, kind: String): Map<String, Any?> {
    val summary = "exit reason=${info.reason} status=${info.status} " +
      "importance=${info.importance} desc=${info.description ?: ""}"
    // Any exit may carry an attached trace (e.g. a recovered-ANR dump left on a later
    // exit), so reading is attempted for every kind. ANR and recovered traces are plain
    // text; native-crash traces are a binary tombstone protobuf that must be decoded,
    // never read as text.
    val detail: String? = try {
      if (info.reason == ApplicationExitInfo.REASON_CRASH_NATIVE) {
        info.traceInputStream?.use { readCapped(it) }?.let { bytes ->
          TombstoneParser.format(bytes)?.let { truncate(it) } ?: base64Fallback(bytes)
        }
      } else {
        info.traceInputStream?.use { String(readCapped(it), Charsets.UTF_8) }
          ?.let { truncate(it) }
      }
    } catch (e: Exception) {
      null
    }
    return mapOf(
      "id" to "${info.timestamp}:${info.pid}",
      "kind" to kind,
      "timestamp" to info.timestamp,
      "summary" to summary,
      "detail" to detail,
      "ackToken" to info.timestamp.toString()
    )
  }

  // Unparseable tombstone: keep the raw bytes decodable offline against AOSP's
  // tombstone.proto instead of dropping them. A protobuf prefix decodes cleanly up to
  // the cut, so partial keeps are marked but still useful.
  private fun base64Fallback(bytes: ByteArray): String {
    val kept = minOf(bytes.size, detailCap / 2)
    val partial = if (kept < bytes.size) " first ${kept}B of ${bytes.size}B" else " ${bytes.size}B"
    return "tombstone protobuf (unparsed,$partial) base64:\n" +
      android.util.Base64.encodeToString(bytes.copyOf(kept), android.util.Base64.NO_WRAP)
  }

  private fun readCapped(stream: InputStream): ByteArray {
    val out = ByteArrayOutputStream()
    val buf = ByteArray(64 * 1024)
    while (out.size() < maxTraceBytes) {
      val n = stream.read(buf, 0, minOf(buf.size, maxTraceBytes - out.size()))
      if (n < 0) break
      out.write(buf, 0, n)
    }
    return out.toByteArray()
  }

  private fun truncate(s: String): String {
    val bytes = s.toByteArray()
    if (bytes.size <= detailCap) return s
    val marker = "\n…[truncated]"
    return String(bytes, 0, detailCap - marker.toByteArray().size, Charsets.UTF_8) + marker
  }
}
