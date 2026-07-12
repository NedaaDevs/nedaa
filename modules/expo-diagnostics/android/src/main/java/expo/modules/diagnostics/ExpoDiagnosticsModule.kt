package expo.modules.diagnostics

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

// Reads OS-recorded process-exit records once each (SharedPreferences timestamp cursor)
// and maps them to the shared NativeDiagnostic shape. API 30+ only.
class ExpoDiagnosticsModule : Module() {
  private val prefsName = "expo_diagnostics"
  private val cursorKey = "last_exit_ts"
  private val detailCap = 64 * 1024

  override fun definition() = ModuleDefinition {
    Name("ExpoDiagnostics")

    AsyncFunction("drain") {
      drain()
    }

    // Throw uncaught on the main thread; the process dies and ApplicationExitInfo records
    // REASON_CRASH with a trace on the next launch.
    Function("testNativeCrash") {
      Handler(Looper.getMainLooper()).post {
        throw RuntimeException("expo-diagnostics test crash")
      }
    }

    // Block the main thread past the input-dispatch timeout to record REASON_ANR.
    Function("testAnr") {
      Handler(Looper.getMainLooper()).post {
        Thread.sleep(10_000)
      }
    }
  }

  private fun drain(): List<Map<String, Any?>> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return emptyList()

    val context = appContext.reactContext ?: return emptyList()
    val am = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
      ?: return emptyList()
    val prefs = context.getSharedPreferences(prefsName, Context.MODE_PRIVATE)
    val records = am.getHistoricalProcessExitReasons(context.packageName, 0, 20)

    // First run (no cursor yet): seed to the newest existing exit and report nothing, so
    // pre-install / pre-update history is not replayed as fresh crashes.
    if (!prefs.contains(cursorKey)) {
      val newest = records.maxOfOrNull { it.timestamp } ?: 0L
      prefs.edit().putLong(cursorKey, newest).apply()
      return emptyList()
    }

    val cursor = prefs.getLong(cursorKey, 0L)
    var maxTs = cursor
    val out = ArrayList<Map<String, Any?>>()

    for (info in records) {
      if (info.timestamp <= cursor) continue
      if (info.timestamp > maxTs) maxTs = info.timestamp
      val kind = mapReason(info.reason) ?: continue
      out.add(toEntry(info, kind))
    }

    prefs.edit().putLong(cursorKey, maxTs).apply()
    return out
  }

  private fun mapReason(reason: Int): String? = when (reason) {
    ApplicationExitInfo.REASON_CRASH -> "crash"
    ApplicationExitInfo.REASON_CRASH_NATIVE -> "crash"
    ApplicationExitInfo.REASON_ANR -> "anr"
    ApplicationExitInfo.REASON_LOW_MEMORY -> "memory"
    ApplicationExitInfo.REASON_SIGNALED -> "other"
    ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "other"
    else -> null // ignore benign exits (user requested, exit self, dependency died, etc.)
  }

  private fun toEntry(info: ApplicationExitInfo, kind: String): Map<String, Any?> {
    val summary = "exit reason=${info.reason} status=${info.status} " +
      "importance=${info.importance} desc=${info.description ?: ""}"
    var detail: String? = null
    // Trace is available for ANR and native crash on supported devices.
    if (kind == "anr" || kind == "crash") {
      detail = try {
        info.traceInputStream?.bufferedReader()?.use { it.readText() }?.let { truncate(it) }
      } catch (e: Exception) {
        null
      }
    }
    return mapOf(
      "id" to UUID.randomUUID().toString(),
      "kind" to kind,
      "timestamp" to info.timestamp,
      "summary" to summary,
      "detail" to detail
    )
  }

  private fun truncate(s: String): String {
    val bytes = s.toByteArray()
    if (bytes.size <= detailCap) return s
    return String(bytes, 0, detailCap / 2, Charsets.UTF_8) + "\n…[truncated]"
  }
}
