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
import java.io.File
import java.io.InputStream
import java.util.concurrent.ConcurrentHashMap

// Reads OS-recorded process-exit records and maps them to the shared NativeDiagnostic
// shape. API 30+ only. Peek/ack protocol: drain() returns records without consuming
// them; the cursor advances only when JS calls ack() after durably persisting the
// entries, so a crash in between replays the records instead of losing them.
class ExpoDiagnosticsModule : Module() {
  private val prefsName = "expo_diagnostics"
  private val cursorKey = "last_exit_ts"
  private val detailCap = 64 * 1024
  // Stack files attached to drained entries, held until ack confirms the entry is
  // persisted. Keyed by ack token so an un-acked drain replays with its stack intact; the
  // token is an exit timestamp, which two exits can share, so each key holds a list.
  private val pendingRecords = ConcurrentHashMap<String, MutableList<File>>()
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

    // Throw an unhandled exception off the JS thread so the recorded stack, the
    // REASON_CRASH exit record, and their pid match can be checked end-to-end.
    Function("testJvmCrash") {
      Handler(Looper.getMainLooper()).post {
        throw IllegalStateException("expo-diagnostics test JVM crash")
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
    // Bound the stack-record directory here rather than at process start, where the
    // filesystem work would sit on the main thread of every launch.
    JvmCrashRecorder.prune(context)
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
    // commit(), not apply(): apply() reports no failure and writes the cursor to disk in
    // the background. If the process died before that landed, the cursor would roll back
    // to a record whose stack file this method had already deleted.
    val advanced =
      maxTs <= prefs.getLong(cursorKey, 0L) || prefs.edit().putLong(cursorKey, maxTs).commit()
    if (!advanced) return
    // A stack file is dead weight once its entry is persisted and the cursor stops that
    // entry from being drained again.
    for (token in tokens) {
      pendingRecords.remove(token)?.forEach { it.delete() }
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
    // Reason and importance are spelled out: the bare integers say nothing to whoever
    // reads a shared report, and they decide what the crash even was.
    val summary = "exit reason=${info.reason} (${reasonName(info.reason)}) " +
      "status=${info.status} importance=${info.importance} " +
      "(${importanceName(info.importance)}) desc=${info.description ?: ""}"
    // Any exit may carry an attached trace (e.g. a recovered-ANR dump left on a later
    // exit), so reading is attempted for every kind. ANR and recovered traces are plain
    // text; native-crash traces are a binary tombstone protobuf that must be decoded,
    // never read as text. The platform never supplies a Java exception stack, so a JVM
    // crash reads the record the process wrote as the exception unwound — falling back to
    // the attached trace, which on such an exit is a recovered-ANR dump.
    val detail: String? = try {
      when (info.reason) {
        ApplicationExitInfo.REASON_CRASH_NATIVE ->
          info.traceInputStream?.use { readCapped(it) }?.let { bytes ->
            TombstoneParser.format(bytes)?.let { truncate(it) } ?: base64Fallback(bytes)
          }
        ApplicationExitInfo.REASON_CRASH -> jvmRecord(info) ?: readTrace(info)
        else -> readTrace(info)
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

  private fun readTrace(info: ApplicationExitInfo): String? =
    info.traceInputStream?.use { String(readCapped(it), Charsets.UTF_8) }?.let { truncate(it) }

  // Matched by pid: the recorder names its file after the process that died, so a backlog
  // of exits cannot attach one crash's stack to another's record. The file is kept until
  // ack, so a drain that never reaches JS replays with its stack.
  private fun jvmRecord(info: ApplicationExitInfo): String? {
    val context = appContext.reactContext ?: return null
    val file = JvmCrashRecorder.recordFor(context, info.pid, info.timestamp) ?: return null
    val text = JvmCrashRecorder.read(file) ?: return null
    pendingRecords.getOrPut(info.timestamp.toString()) { mutableListOf() }.add(file)
    return truncate(text)
  }

  private fun reasonName(reason: Int): String = when (reason) {
    ApplicationExitInfo.REASON_CRASH -> "jvm-crash"
    ApplicationExitInfo.REASON_CRASH_NATIVE -> "native-crash"
    ApplicationExitInfo.REASON_ANR -> "anr"
    ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "init-failure"
    ApplicationExitInfo.REASON_LOW_MEMORY -> "low-memory"
    ApplicationExitInfo.REASON_SIGNALED -> "signalled"
    ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "excessive-resource"
    else -> "reason-$reason"
  }

  // Importance separates a crash the user watched from one in a process the system had
  // already parked, which points at completely different code.
  private fun importanceName(importance: Int): String = when (importance) {
    ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND -> "foreground"
    ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND_SERVICE -> "foreground-service"
    ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE -> "visible"
    ActivityManager.RunningAppProcessInfo.IMPORTANCE_PERCEPTIBLE -> "perceptible"
    ActivityManager.RunningAppProcessInfo.IMPORTANCE_SERVICE -> "service"
    ActivityManager.RunningAppProcessInfo.IMPORTANCE_CACHED -> "cached"
    ActivityManager.RunningAppProcessInfo.IMPORTANCE_GONE -> "gone"
    else -> "importance-$importance"
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
