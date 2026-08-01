package expo.modules.diagnostics

import java.io.ByteArrayOutputStream

// Standalone verification for TombstoneParser (no Android unit-test target in this module).
// Run: kotlinc ../src/main/java/expo/modules/diagnostics/TombstoneParser.kt TombstoneParserTest.kt -include-runtime -d /tmp/tombstone-test.jar && java -cp /tmp/tombstone-test.jar expo.modules.diagnostics.TombstoneParserTestKt

// Minimal protobuf wire encoder for building synthetic tombstones in tests.
private class ProtoWriter {
  private val out = ByteArrayOutputStream()

  fun toByteArray(): ByteArray = out.toByteArray()

  fun varint(field: Int, value: Long): ProtoWriter {
    writeVarint((field.toLong() shl 3) or 0L)
    writeVarint(value)
    return this
  }

  fun string(field: Int, value: String): ProtoWriter = bytes(field, value.toByteArray())

  fun bytes(field: Int, value: ByteArray): ProtoWriter {
    writeVarint((field.toLong() shl 3) or 2L)
    writeVarint(value.size.toLong())
    out.write(value)
    return this
  }

  fun message(field: Int, build: ProtoWriter.() -> Unit): ProtoWriter {
    val nested = ProtoWriter()
    nested.build()
    return bytes(field, nested.toByteArray())
  }

  fun fixed64(field: Int, value: Long): ProtoWriter {
    writeVarint((field.toLong() shl 3) or 1L)
    for (i in 0 until 8) out.write(((value ushr (i * 8)) and 0xFF).toInt())
    return this
  }

  private fun writeVarint(v: Long) {
    var value = v
    while (true) {
      if (value and 0x7FL.inv() == 0L) {
        out.write(value.toInt())
        return
      }
      out.write(((value and 0x7F) or 0x80).toInt())
      value = value ushr 7
    }
  }
}

// Encodes rel_pc (field 1) plus a decoy absolute pc (field 2) so the tests prove the
// parser reads the symbolication-relevant field, not the ASLR-randomized one.
private fun ProtoWriter.frame(relPc: Long, fn: String?, fnOffset: Long, file: String, buildId: String?) {
  message(4) {
    varint(1, relPc)
    varint(2, relPc + 0x7000000000L)
    if (fn != null) {
      string(4, fn)
      varint(5, fnOffset)
    }
    string(6, file)
    if (buildId != null) string(8, buildId)
  }
}

// A tombstone resembling the real SIGBUS crash from the HONOR report: two threads,
// crashing tid=8123, unknown fields sprinkled in, threads emitted BEFORE the tid field
// so field order cannot be assumed.
private fun buildFullTombstone(): ByteArray = ProtoWriter().apply {
  varint(1, 1) // arch ARM64
  string(2, "HONOR/FCP-N49/HNFCPX:16/HONORFCP-N49/10.0.0.157:user/release-keys")
  string(4, "2026-08-01 18:41:54.112543248+0300")
  // threads map before pid/tid: entry = { key=1 varint tid, value=2 Thread }
  message(16) {
    varint(1, 8123)
    message(2) {
      varint(1, 8123)
      string(2, "mqt_native_modu")
      frame(0xa1b2cL, "sqlite3_step", 0x7cL, "/data/app/lib/arm64/libsqlite3x.so", "abc123def456")
      frame(0xdeadL, null, 0L, "/apex/com.android.runtime/lib64/bionic/libc.so", "fedcba")
      string(7, "note: unreadable elf") // backtrace_note
    }
  }
  message(16) {
    varint(1, 8200)
    message(2) {
      varint(1, 8200)
      string(2, "Jit thread pool")
      frame(0x1111L, "idle_fn", 0x4L, "/apex/other.so", null)
    }
  }
  varint(5, 8100) // pid
  varint(6, 8123) // tid
  string(8, "u:r:untrusted_app:s0:c44")
  message(10) { // signal_info
    varint(1, 7)
    string(2, "SIGBUS")
    varint(3, 1)
    string(4, "BUS_ADRALN")
    varint(8, 1) // has_fault_address
    varint(9, 0x7bf1a2c000L) // fault_address
  }
  string(14, "mmap fault on quran.db")
  message(15) { string(1, "possible truncated mmap") } // cause
  varint(20, 5) // process_uptime seconds
  varint(22, 4096) // page_size (should be ignored)
  message(17) { varint(1, 0x1000); varint(2, 0x2000) } // memory_mappings (ignored)
}.toByteArray()

private var failures = 0

private fun check(name: String, condition: Boolean, context: String = "") {
  if (condition) {
    println("PASS $name")
  } else {
    failures++
    println("FAIL $name${if (context.isNotEmpty()) " — $context" else ""}")
  }
}

fun main() {
  val full = TombstoneParser.format(buildFullTombstone())
  check("full: parses", full != null)
  val text = full ?: ""
  check("full: signal line", text.contains("signal 7 (SIGBUS), code 1 (BUS_ADRALN)"), text)
  check("full: fault address", text.contains("fault addr 0x7bf1a2c000"), text)
  check("full: abort message", text.contains("Abort message: 'mmap fault on quran.db'"), text)
  check("full: cause", text.contains("Cause: possible truncated mmap"), text)
  check("full: pid/tid/thread name", text.contains("pid 8100, tid 8123 (mqt_native_modu)"), text)
  check("full: uptime", text.contains("uptime 5s"), text)
  check(
    "full: frame with function",
    text.contains("#00 pc 0x00000000000a1b2c /data/app/lib/arm64/libsqlite3x.so (sqlite3_step+124) (BuildId: abc123def456)"),
    text
  )
  check("full: frame without function", text.contains("#01 pc 0x000000000000dead /apex/com.android.runtime/lib64/bionic/libc.so"), text)
  check("full: backtrace note", text.contains("note: unreadable elf"), text)
  check("full: other thread excluded", !text.contains("Jit thread pool") && !text.contains("idle_fn"), text)

  // Signal only, no threads: still produces a summary.
  val signalOnly = ProtoWriter().apply {
    varint(5, 1)
    varint(6, 1)
    message(10) { varint(1, 11); string(2, "SIGSEGV") }
  }.toByteArray()
  val partial = TombstoneParser.format(signalOnly)
  check("partial: parses", partial != null)
  check("partial: signal", (partial ?: "").contains("signal 11 (SIGSEGV)"), partial ?: "")

  // Garbage and truncation must return null, never throw.
  check("garbage: null", TombstoneParser.format(byteArrayOf(0x1F, -1, -1, -1, -1, -1)) == null)
  check("truncated: null or safe", runCatching { TombstoneParser.format(buildFullTombstone().copyOfRange(0, 40)) }.isSuccess)
  check("empty: null", TombstoneParser.format(ByteArray(0)) == null)

  // Hostile length whose Long addition overflows: `pos + len` wraps negative, which
  // once moved the cursor backwards and looped forever. Must return null promptly.
  val overflowLen = byteArrayOf(
    0x0a, 0xf6.toByte(), 0xff.toByte(), 0xff.toByte(), 0xff.toByte(),
    0xff.toByte(), 0xff.toByte(), 0xff.toByte(), 0xff.toByte(), 0x7f
  )
  check("overflow length: null", TombstoneParser.format(overflowLen) == null)

  // 70 frames on the crashing thread: 64 emitted + a "+6 more" marker.
  val manyFrames = ProtoWriter().apply {
    varint(5, 1)
    varint(6, 42)
    message(16) {
      varint(1, 42)
      message(2) {
        varint(1, 42)
        string(2, "main")
        repeat(70) { i -> frame(i.toLong(), null, 0L, "/lib.so", null) }
      }
    }
  }.toByteArray()
  val capped = TombstoneParser.format(manyFrames) ?: ""
  check("frame cap: #63 kept, #64 dropped", capped.contains("#63") && !capped.contains("#64"), capped.take(200))
  check("frame cap: marker", capped.contains("… [+6 more frames]"), capped.takeLast(120))

  println(if (failures == 0) "ALL TESTS PASSED" else "$failures TEST(S) FAILED")
  if (failures > 0) kotlin.system.exitProcess(1)
}
