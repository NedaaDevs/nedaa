package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

// The age rows are the table the JS test of endsByAge reads, so both agree.
class PendingChallengeRuleTest {

    private val pendingId = "alarm-1"
    private val ringingIds = mapOf("self" to pendingId, "other" to "alarm-2", "none" to null)

    private data class Row(val ringing: String, val ageMs: Long, val endsByAge: Boolean)

    private val shared: List<Row> = run {
        val stream = checkNotNull(javaClass.classLoader?.getResourceAsStream("stale-rule.tsv")) {
            "missing fixture stale-rule.tsv"
        }
        stream.bufferedReader(Charsets.UTF_8).use { it.readLines() }
            .drop(1)
            .filter { it.isNotEmpty() }
            .map { it.split('\t') }
            .map { (ringing, age, ends) -> Row(ringing, age.toLong(), ends.toBooleanStrict()) }
    }

    @Test
    fun anUncompletedRowIsOpenUntilItEndsByAge() {
        val failures = shared.filter { row ->
            val open = PendingChallengeRule.isOpen(false, pendingId, ringingIds.getValue(row.ringing), row.ageMs)
            open == row.endsByAge
        }
        assertEquals(emptyList<Row>(), failures)
    }

    @Test
    fun theTableUsesTheNativeThreshold() {
        assertEquals(true, shared.any { it.ageMs == PendingChallengeRule.STALE_PENDING_MS })
    }

    @Test
    fun aCompletedOrMissingRowIsNeverOpen() {
        for (completed in listOf(true, null)) {
            for (ringing in ringingIds.values) {
                assertEquals(false, PendingChallengeRule.isOpen(completed, pendingId, ringing, 0))
            }
        }
    }
}
