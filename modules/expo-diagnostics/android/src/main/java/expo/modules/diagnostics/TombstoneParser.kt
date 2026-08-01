package expo.modules.diagnostics

// Formats the protobuf tombstone that ApplicationExitInfo.getTraceInputStream() returns
// for REASON_CRASH_NATIVE into a debuggerd-style text summary: signal, abort message,
// causes, and the crashing thread's backtrace. Hand-rolled wire-format reader over
// AOSP's debuggerd/proto/tombstone.proto — only the fields useful in a crash report
// are decoded; everything else (registers, memory dumps, log buffers) is skipped.
object TombstoneParser {
  private const val MAX_FRAMES = 64

  // Wire types
  private const val VARINT = 0
  private const val FIXED64 = 1
  private const val LEN = 2
  private const val FIXED32 = 5

  fun format(bytes: ByteArray): String? =
    try {
      parseTombstone(Reader(bytes, 0, bytes.size))?.takeIf { it.isNotBlank() }
    } catch (e: Exception) {
      null
    }

  private class Reader(val buf: ByteArray, var pos: Int, val end: Int) {
    fun hasMore() = pos < end

    fun readVarint(): Long {
      var result = 0L
      var shift = 0
      while (shift < 64) {
        if (pos >= end) throw IllegalStateException("varint past end")
        val b = buf[pos++].toInt()
        result = result or ((b.toLong() and 0x7F) shl shift)
        if (b and 0x80 == 0) return result
        shift += 7
      }
      throw IllegalStateException("varint too long")
    }

    // Returns a sub-reader over a length-delimited field's payload.
    fun readLen(): Reader {
      val len = readVarint()
      if (len < 0 || pos + len > end) throw IllegalStateException("length past end")
      val r = Reader(buf, pos, pos + len.toInt())
      pos += len.toInt()
      return r
    }

    fun readString(): String = readLen().let { String(buf, it.pos, it.end - it.pos, Charsets.UTF_8) }

    fun skip(wireType: Int) {
      when (wireType) {
        VARINT -> readVarint()
        FIXED64 -> advance(8)
        LEN -> readLen()
        FIXED32 -> advance(4)
        else -> throw IllegalStateException("unsupported wire type $wireType")
      }
    }

    private fun advance(n: Int) {
      if (pos + n > end) throw IllegalStateException("skip past end")
      pos += n
    }
  }

  // Walks a message, dispatching each field to `field`; unhandled fields must be skipped
  // by the callback returning false.
  private inline fun forEachField(r: Reader, field: (num: Int, wireType: Int) -> Boolean) {
    while (r.hasMore()) {
      val tag = r.readVarint()
      val num = (tag ushr 3).toInt()
      val wireType = (tag and 7).toInt()
      if (num == 0) throw IllegalStateException("invalid field number 0")
      if (!field(num, wireType)) r.skip(wireType)
    }
  }

  private class SignalInfo {
    var number = 0
    var name = ""
    var code = 0
    var codeName = ""
    var hasFaultAddress = false
    var faultAddress = 0L
  }

  private class ThreadInfo {
    var name = ""
    val frames = ArrayList<String>()
    val notes = ArrayList<String>()
  }

  private fun parseTombstone(r: Reader): String? {
    var pid = 0L
    var tid = 0L
    var uptime = 0L
    var abortMessage = ""
    var signal: SignalInfo? = null
    val causes = ArrayList<String>()
    // tid may be serialized after the threads map, so keep every entry until the end.
    val threads = HashMap<Long, ThreadInfo>()

    forEachField(r) { num, wireType ->
      when {
        num == 5 && wireType == VARINT -> { pid = r.readVarint(); true }
        num == 6 && wireType == VARINT -> { tid = r.readVarint(); true }
        num == 20 && wireType == VARINT -> { uptime = r.readVarint(); true }
        num == 10 && wireType == LEN -> { signal = parseSignal(r.readLen()); true }
        num == 14 && wireType == LEN -> { abortMessage = r.readString(); true }
        num == 15 && wireType == LEN -> { parseCause(r.readLen())?.let { causes.add(it) }; true }
        num == 16 && wireType == LEN -> { parseThreadEntry(r.readLen(), threads); true }
        else -> false
      }
    }

    if (signal == null && abortMessage.isEmpty() && causes.isEmpty() && threads.isEmpty() && pid == 0L) {
      return null
    }

    val out = StringBuilder()
    signal?.let {
      out.append("signal ${it.number} (${it.name.ifEmpty { "?" }}), code ${it.code} (${it.codeName.ifEmpty { "?" }})")
      if (it.hasFaultAddress) out.append(", fault addr 0x${java.lang.Long.toHexString(it.faultAddress)}")
      out.append('\n')
    }
    if (abortMessage.isNotEmpty()) out.append("Abort message: '$abortMessage'\n")
    for (cause in causes) out.append("Cause: $cause\n")

    val crashing = threads[tid]
    out.append("pid $pid, tid $tid")
    crashing?.let { if (it.name.isNotEmpty()) out.append(" (${it.name})") }
    if (uptime > 0) out.append(", uptime ${uptime}s")
    out.append('\n')

    crashing?.let { thread ->
      for (note in thread.notes) out.append(note).append('\n')
      if (thread.frames.isNotEmpty()) {
        out.append("backtrace:\n")
        for (frame in thread.frames) out.append(frame).append('\n')
      }
    }
    return out.toString().trimEnd()
  }

  private fun parseSignal(r: Reader): SignalInfo {
    val s = SignalInfo()
    forEachField(r) { num, wireType ->
      when {
        num == 1 && wireType == VARINT -> { s.number = r.readVarint().toInt(); true }
        num == 2 && wireType == LEN -> { s.name = r.readString(); true }
        num == 3 && wireType == VARINT -> { s.code = r.readVarint().toInt(); true }
        num == 4 && wireType == LEN -> { s.codeName = r.readString(); true }
        num == 8 && wireType == VARINT -> { s.hasFaultAddress = r.readVarint() != 0L; true }
        num == 9 && wireType == VARINT -> { s.faultAddress = r.readVarint(); true }
        else -> false
      }
    }
    return s
  }

  private fun parseCause(r: Reader): String? {
    var humanReadable: String? = null
    forEachField(r) { num, wireType ->
      when {
        num == 1 && wireType == LEN -> { humanReadable = r.readString(); true }
        else -> false
      }
    }
    return humanReadable
  }

  // threads is map<uint32, Thread>: each entry is a message with key=1, value=2.
  private fun parseThreadEntry(r: Reader, threads: HashMap<Long, ThreadInfo>) {
    var key = -1L
    var thread: ThreadInfo? = null
    forEachField(r) { num, wireType ->
      when {
        num == 1 && wireType == VARINT -> { key = r.readVarint(); true }
        num == 2 && wireType == LEN -> { thread = parseThread(r.readLen()); true }
        else -> false
      }
    }
    val t = thread
    if (key >= 0 && t != null) threads[key] = t
  }

  private fun parseThread(r: Reader): ThreadInfo {
    val t = ThreadInfo()
    forEachField(r) { num, wireType ->
      when {
        num == 2 && wireType == LEN -> { t.name = r.readString(); true }
        num == 4 && wireType == LEN -> {
          val frame = parseFrame(r.readLen())
          if (t.frames.size < MAX_FRAMES) t.frames.add(formatFrame(t.frames.size, frame))
          true
        }
        num == 7 && wireType == LEN -> { t.notes.add(r.readString()); true }
        else -> false
      }
    }
    return t
  }

  private class Frame {
    var pc = 0L
    var functionName = ""
    var functionOffset = 0L
    var fileName = ""
    var buildId = ""
  }

  private fun parseFrame(r: Reader): Frame {
    val f = Frame()
    forEachField(r) { num, wireType ->
      when {
        num == 2 && wireType == VARINT -> { f.pc = r.readVarint(); true }
        num == 4 && wireType == LEN -> { f.functionName = r.readString(); true }
        num == 5 && wireType == VARINT -> { f.functionOffset = r.readVarint(); true }
        num == 6 && wireType == LEN -> { f.fileName = r.readString(); true }
        num == 8 && wireType == LEN -> { f.buildId = r.readString(); true }
        else -> false
      }
    }
    return f
  }

  private fun formatFrame(index: Int, f: Frame): String {
    val out = StringBuilder()
    out.append("  #").append(String.format("%02d", index))
    out.append(" pc 0x").append(String.format("%016x", f.pc))
    out.append(' ').append(f.fileName.ifEmpty { "<unknown>" })
    if (f.functionName.isNotEmpty()) {
      out.append(" (").append(f.functionName)
      if (f.functionOffset > 0) out.append('+').append(f.functionOffset)
      out.append(')')
    }
    if (f.buildId.isNotEmpty()) out.append(" (BuildId: ").append(f.buildId).append(')')
    return out.toString()
  }
}
