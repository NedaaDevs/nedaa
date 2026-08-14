package expo.modules.diagnostics

import java.io.PrintWriter
import java.io.Writer
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

// Record shape and file naming for captured JVM crashes. Free of Android imports so
// android/scripts/JvmCrashFormatterTest.kt can verify it without a device.
//
// The file name carries the pid and the write time. Both are needed to tie a record to an
// ApplicationExitInfo entry: several exits can be pending at once, and Android reuses pids.
object JvmCrashFormatter {
  const val MAX_RECORD_CHARS = 32 * 1024
  private const val TRUNCATED = "\n…[truncated]"
  private const val SUFFIX = ".txt"

  // Header plus the printStackTrace chain, which includes causes and suppressed
  // exceptions. The stack is written through a capped writer rather than captured whole
  // and trimmed afterwards: this runs while the process is already failing, and an
  // exception graph of any size must not drive a second allocation failure.
  fun format(threadName: String, error: Throwable, pid: Int, timeMs: Long): String {
    val header = "jvm-crash pid=$pid thread=$threadName at ${iso(timeMs)}\n"
    val room = (MAX_RECORD_CHARS - header.length - TRUNCATED.length).coerceAtLeast(0)
    val writer = CappedWriter(room)
    try {
      error.printStackTrace(PrintWriter(writer))
    } catch (_: Throwable) {
      // A throwable whose own printStackTrace fails still leaves the header and whatever
      // frames were written before the failure.
    }
    return header + writer.text() + if (writer.truncated) TRUNCATED else ""
  }

  fun fileName(pid: Int, timeMs: Long): String = "${filePrefix(pid)}$timeMs$SUFFIX"

  // Trailing separator included: without it pid 123 also matches pid 1234.
  fun filePrefix(pid: Int): String = "jvm-$pid-"

  // The write time encoded in a record's name, or null when the name belongs to another
  // pid or is not a record. Read from the name rather than the file's mtime: this is the
  // same clock ApplicationExitInfo stamps its exits with, so the two are comparable.
  fun writeTimeFromName(name: String, pid: Int): Long? {
    val prefix = filePrefix(pid)
    if (!name.startsWith(prefix) || !name.endsWith(SUFFIX)) return null
    return name.substring(prefix.length, name.length - SUFFIX.length).toLongOrNull()
  }

  private fun iso(timeMs: Long): String =
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
      .apply { timeZone = TimeZone.getTimeZone("UTC") }
      .format(Date(timeMs))

  // Accepts up to `limit` characters and silently drops the rest, so the buffer cannot
  // grow past the cap however large the stack is.
  private class CappedWriter(private val limit: Int) : Writer() {
    private val builder = StringBuilder()
    var truncated = false
      private set

    fun text(): String = builder.toString()

    override fun write(cbuf: CharArray, off: Int, len: Int) {
      val room = limit - builder.length
      if (room <= 0) {
        if (len > 0) truncated = true
        return
      }
      val take = minOf(len, room)
      builder.appendRange(cbuf, off, off + take)
      if (take < len) truncated = true
    }

    override fun flush() {}

    override fun close() {}
  }
}
