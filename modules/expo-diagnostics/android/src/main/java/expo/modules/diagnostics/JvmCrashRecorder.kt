package expo.modules.diagnostics

import android.content.Context
import android.os.Process
import java.io.File
import kotlin.system.exitProcess

// Captures the stack of an unhandled Java/Kotlin exception while it is still on the
// thread. ApplicationExitInfo records these exits as REASON_CRASH but supplies no Java
// exception stack — only ANRs and native tombstones carry a trace — so without this a JVM
// crash reduces to a reason code with no location. Records are written to filesDir keyed
// by pid, and ExpoDiagnosticsModule matches them back to the exit record on the next
// launch.
object JvmCrashRecorder {
  private const val DIR_NAME = "diagnostics-jvm"
  // Named apart from the record prefix so a half-written file can never be matched to an
  // exit record.
  private const val TEMP_PREFIX = "partial-"
  private const val MAX_RECORDS = 10
  private const val RETENTION_MS = 14L * 24 * 60 * 60 * 1000

  @Volatile
  private var installed = false

  // Installed once per process, and scans nothing: this runs on the main thread during
  // process start, where slow work delays every launch. Pruning happens later, on the
  // drain path. A second call is ignored so the handler can never chain to itself.
  fun install(context: Context) {
    synchronized(this) {
      if (installed) return
      installed = true
    }

    val dir = directory(context)
    val previous = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      try {
        write(dir, thread, error)
      } catch (_: Throwable) {
        // The record is best-effort. A failure here must not mask the real crash.
      }
      try {
        previous?.uncaughtException(thread, error)
      } catch (_: Throwable) {
        // A handler further down the chain that throws must not stop the process from
        // dying, or the app hangs in a broken state instead of restarting.
      }
      // Reached only when nothing downstream ended the process. The platform handler
      // normally kills it here and this never runs; a handler that returns instead would
      // otherwise leave a process alive after a fatal exception.
      Process.killProcess(Process.myPid())
      exitProcess(10)
    }
  }

  // The record left by the process that died, or null when that process crashed natively,
  // was killed, or predates this recorder.
  //
  // Android recycles pids, so the pid alone can match a record from an unrelated process.
  // The record is always written before the process dies, so the exit time is a hard upper
  // bound: any record stamped later belongs to a different life of the same pid.
  fun recordFor(context: Context, pid: Int, exitTimeMs: Long): File? =
    directory(context)
      .listFiles()
      ?.mapNotNull { file ->
        JvmCrashFormatter.writeTimeFromName(file.name, pid)
          ?.takeIf { it <= exitTimeMs }
          ?.let { file to it }
      }
      ?.maxByOrNull { it.second }
      ?.first

  fun read(file: File): String? = try {
    file.readText()
  } catch (_: Exception) {
    null
  }

  // Called from the drain path rather than at process start: this touches the filesystem,
  // and the 14-day/10-record bounds do not need pruning by processes that only serve a
  // broadcast.
  fun prune(context: Context) {
    val dir = directory(context)
    val files = dir.listFiles() ?: return
    val cutoff = System.currentTimeMillis() - RETENTION_MS
    files
      .filter { it.lastModified() >= cutoff || !it.delete() }
      .sortedByDescending { it.lastModified() }
      .drop(MAX_RECORDS)
      .forEach { it.delete() }
  }

  private fun directory(context: Context): File = File(context.filesDir, DIR_NAME)

  // Written to a temporary name and renamed into place, so a record that a kill or a full
  // disk cut short is never read back as a complete stack.
  private fun write(dir: File, thread: Thread, error: Throwable) {
    if (!dir.exists() && !dir.mkdirs()) return
    val pid = Process.myPid()
    val now = System.currentTimeMillis()
    val temp = File(dir, "$TEMP_PREFIX$pid-$now")
    temp.writeText(JvmCrashFormatter.format(thread.name, error, pid, now))
    if (!temp.renameTo(File(dir, JvmCrashFormatter.fileName(pid, now)))) {
      temp.delete()
    }
  }
}
