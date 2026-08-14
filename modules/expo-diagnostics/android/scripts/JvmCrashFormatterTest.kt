package expo.modules.diagnostics

// Standalone verification for JvmCrashFormatter (no Android unit-test target in this module).
// Run: kotlinc ../src/main/java/expo/modules/diagnostics/JvmCrashFormatter.kt JvmCrashFormatterTest.kt -include-runtime -d /tmp/jvm-crash-test.jar && java -cp /tmp/jvm-crash-test.jar expo.modules.diagnostics.JvmCrashFormatterTestKt

private var failures = 0

private fun check(name: String, condition: Boolean) {
  if (condition) {
    println("  ok   $name")
  } else {
    println("  FAIL $name")
    failures++
  }
}

private fun testHeaderCarriesIdentity() {
  val record = JvmCrashFormatter.format("main", IllegalStateException("boom"), 4242, 1_786_609_911_817)
  val header = record.lineSequence().first()
  check("header names the pid", header.contains("pid=4242"))
  check("header names the thread", header.contains("thread=main"))
  check("header stamps UTC", header.contains("at 2026-08-13T08:31:51.817Z"))
}

private fun testStackAndCausesSurvive() {
  val cause = IllegalArgumentException("bad input")
  val error = IllegalStateException("outer failure", cause)
  val record = JvmCrashFormatter.format("Binder:1", error, 7, 0)
  check("names the exception type", record.contains("java.lang.IllegalStateException: outer failure"))
  check("keeps the cause chain", record.contains("Caused by: java.lang.IllegalArgumentException: bad input"))
  check("keeps frames", record.contains("\tat "))
}

private fun testOversizedRecordKeepsTopFrames() {
  val error = RuntimeException("x".repeat(JvmCrashFormatter.MAX_RECORD_CHARS * 2))
  val record = JvmCrashFormatter.format("main", error, 1, 0)
  check("caps the record", record.length <= JvmCrashFormatter.MAX_RECORD_CHARS)
  check("marks the cut", record.endsWith("…[truncated]"))
  check("keeps the header", record.startsWith("jvm-crash pid=1 "))
}

// A deep cause chain is the shape that would blow the buffer if the stack were captured
// whole and trimmed afterwards.
private fun testDeepCauseChainStaysBounded() {
  var error = RuntimeException("root")
  repeat(500) { error = RuntimeException("layer $it: ${"y".repeat(200)}", error) }
  val record = JvmCrashFormatter.format("main", error, 9, 0)
  check("caps a deep cause chain", record.length <= JvmCrashFormatter.MAX_RECORD_CHARS)
  check("marks the deep chain cut", record.endsWith("…[truncated]"))
  check("keeps the outermost failure", record.contains("layer 499"))
}

private fun testUntruncatedRecordHasNoMarker() {
  val record = JvmCrashFormatter.format("main", RuntimeException("small"), 2, 0)
  check("short record is unmarked", !record.endsWith("…[truncated]"))
  check("short record keeps its message", record.contains("java.lang.RuntimeException: small"))
}

// Android reuses pids, so a record is only this exit's if it was written before the exit.
private fun testWriteTimeGatesPidReuse() {
  check("reads the write time back", JvmCrashFormatter.writeTimeFromName("jvm-77-1500.txt", 77) == 1500L)
  check("rejects another pid", JvmCrashFormatter.writeTimeFromName("jvm-78-1500.txt", 77) == null)
  check("rejects a longer pid", JvmCrashFormatter.writeTimeFromName("jvm-771-1500.txt", 77) == null)
  check("rejects a partial file", JvmCrashFormatter.writeTimeFromName("partial-77-1500", 77) == null)
  check("rejects a non-numeric stamp", JvmCrashFormatter.writeTimeFromName("jvm-77-abc.txt", 77) == null)

  // An exit at 1000 must not adopt the record of a later crash that reused the pid, even
  // though that record is the newest one for the pid.
  val exitTime = 1000L
  val names = listOf("jvm-77-900.txt", "jvm-77-1400.txt")
  val chosen = names
    .mapNotNull { n -> JvmCrashFormatter.writeTimeFromName(n, 77)?.takeIf { it <= exitTime }?.let { n to it } }
    .maxByOrNull { it.second }
    ?.first
  check("picks the record written before the exit", chosen == "jvm-77-900.txt")
}

private fun testFileNamingIsPidExact() {
  val name = JvmCrashFormatter.fileName(123, 999)
  check("file name matches its own prefix", name.startsWith(JvmCrashFormatter.filePrefix(123)))
  check("file name carries the time", name == "jvm-123-999.txt")
  // A prefix without the trailing separator would match pid 1234 as well as pid 123,
  // which would attach one process's stack to another process's exit record.
  check("prefix does not match a longer pid", !name.startsWith(JvmCrashFormatter.filePrefix(12)))
  check("longer pid does not match this prefix",
    !JvmCrashFormatter.fileName(1234, 999).startsWith(JvmCrashFormatter.filePrefix(123)))
}

fun main() {
  println("JvmCrashFormatter")
  testHeaderCarriesIdentity()
  testStackAndCausesSurvive()
  testOversizedRecordKeepsTopFrames()
  testDeepCauseChainStaysBounded()
  testUntruncatedRecordHasNoMarker()
  testFileNamingIsPidExact()
  testWriteTimeGatesPidReuse()
  if (failures > 0) {
    println("$failures check(s) failed")
    kotlin.system.exitProcess(1)
  }
  println("all checks passed")
}
