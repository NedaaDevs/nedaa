package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

// tap-press.tsv and shell-constants.tsv, read by the JS tests too.
class TapPressTest {

    @Test
    fun aPressCountsOnlyAfterTheGap() {
        for ((last, now, counts) in sharedTable("tap-press.tsv")) {
            val lastCounted = if (last == FIXTURE_NONE) null else last.toLong()
            assertEquals("$last $now", counts.toBooleanStrict(), TapPress.counts(lastCounted, now.toLong()))
        }
    }

    @Test
    fun theShellConstantsMatchTheJs() {
        val native = mapOf(
            "TAP_PRESSES" to TapBoard.TAP_PRESSES.toLong(),
            "TAP_PRESS_MIN_GAP_MS" to TapPress.MIN_GAP_MS,
            "HANDOVER_SHOWN_MS" to TaskShellRun.HANDOVER_MS,
        )
        val rows = sharedTable("shell-constants.tsv")
        assertEquals(native.keys.toList(), rows.map { it[0] })
        for ((name, value) in rows) assertEquals(name, value.toLong(), native[name])
    }
}
