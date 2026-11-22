package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

// tap-press, tap-board and shell-constants tables, read by the JS tests too.
class TapPressTest {

    @Test
    fun aPressCountsOnlyAfterTheGap() {
        for ((last, now, counts) in sharedTable("tap-press.tsv")) {
            val lastCounted = if (last == FIXTURE_NONE) null else last.toLong()
            assertEquals("$last $now", counts.toBooleanStrict(), TapPress.counts(lastCounted, now.toLong()))
        }
    }

    @Test
    fun everyScriptOfPressesMatchesJs() {
        val rows = sharedTable("tap-board.tsv")
        for ((name, steps) in rows.groupBy { it[0] }) {
            var state = TapBoardState()
            for ((_, at, outcome, done, status) in steps) {
                val press = TapPress.press(state, at.toLong())
                state = press.state
                val said = TapPress.statusOf(state.done)?.toString() ?: FIXTURE_NONE
                assertEquals("$name at $at", listOf(outcome, done, status), listOf(press.outcome.id, "${state.done}", said))
            }
        }
        assertEquals(TapOutcome.entries.map { it.id }.toSet(), rows.map { it[2] }.toSet())
    }

    @Test
    fun anIgnoredPressKeepsTheState() {
        val solved = (0 until TapPress.PRESSES).fold(TapBoardState()) { state, press ->
            TapPress.press(state, press * TapPress.MIN_GAP_MS).state
        }
        assertSame(solved, TapPress.press(solved, Long.MAX_VALUE).state)
        assertNull(TapPress.statusOf(solved.done))
    }

    @Test
    fun nothingIsSaidBeforeTheFirstPress() {
        assertNull(TapPress.statusOf(TapBoardState().done))
    }

    @Test
    fun theShellConstantsMatchTheJs() {
        val native = mapOf(
            "TAP_PRESSES" to TapPress.PRESSES.toDouble(),
            "TAP_PRESS_MIN_GAP_MS" to TapPress.MIN_GAP_MS.toDouble(),
            "WRONG_CARD_HOLD_MS" to MathBoardRun.WRONG_HOLD_MS.toDouble(),
            "HANDOVER_SHOWN_MS" to TaskShellRun.HANDOVER_MS.toDouble(),
            "BOARD_SWAP_IN_MS" to MathCardsBoard.SWAP_IN_MS.toDouble(),
            "PRESS_SCALE" to TapBoard.PRESS_SCALE.toDouble(),
            "PRESS_DOWN_MS" to TapBoard.PRESS_DOWN_MS.toDouble(),
        )
        val rows = sharedTable("shell-constants.tsv")
        assertEquals(native.keys.toList(), rows.map { it[0] })
        for ((name, value) in rows) assertEquals(name, value.toDouble(), checkNotNull(native[name]), CONSTANT_DELTA)
    }

    private companion object {
        // A Float constant read back as a Double is off in the eighth place.
        const val CONSTANT_DELTA = 1e-6
    }
}
