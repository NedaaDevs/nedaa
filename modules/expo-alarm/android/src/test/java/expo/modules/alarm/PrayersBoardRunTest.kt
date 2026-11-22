package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Test

// prayers-board.tsv: what the JS prayersBoard rules do for each script.
class PrayersBoardRunTest {

    private val rows = sharedTable("prayers-board.tsv")

    private fun outcomeOf(tap: PrayersTap): String = when (tap) {
        is PrayersTap.Placed -> FixtureOutcome.PLACED
        is PrayersTap.Done -> FixtureOutcome.DONE
        is PrayersTap.Wrong -> FixtureOutcome.WRONG
        PrayersTap.Ignored -> FixtureOutcome.IGNORED
    }

    private fun saidCell(said: List<PlaceSaid>): String =
        if (said.isEmpty()) FIXTURE_NONE else said.joinToString(",") { "${it.part.id}:${it.prayer.id}" }

    private fun lineCell(line: PrayersLine): String = line.prayer?.let { "${line.id}:${it.id}" } ?: line.id

    private fun shown(state: PrayersBoardState): List<String> = listOf(
        state.order.deal.joinToString(",") { it.id },
        state.order.placed.toString(),
        state.order.deal.indices.joinToString(",") { state.cardState(it).id },
        lineCell(state.line),
        saidCell(state.placesSpoken),
    )

    @Test
    fun everyScriptMatchesJs() {
        for ((name, caseRows) in rows.groupBy { it[0] }) {
            var rng: TaskRng.Rng? = null
            var state: PrayersBoardState? = null
            for (row in caseRows) {
                val (_, op, arg) = row
                var outcome = FIXTURE_NONE
                var said = FIXTURE_NONE
                state = when (op) {
                    FixtureOp.START -> PrayersBoardRun.start(TaskRng.seeded(arg.toLong()).also { rng = it })
                    FixtureOp.TAP -> {
                        val tap = PrayersBoardRun.tap(checkNotNull(state), arg.toInt())
                        outcome = outcomeOf(tap)
                        if (tap is PrayersTap.Placed) said = saidCell(tap.state.placedSaid)
                        tap.state ?: state
                    }
                    FixtureOp.HOLD -> PrayersBoardRun.endHold(checkNotNull(state), checkNotNull(rng))
                    else -> error("unknown op $op")
                }
                val board = checkNotNull(state)
                val actual = listOf(outcome) + shown(board) +
                    listOf(said, board.deals.toString(), board.solved.toString())
                assertEquals("$name $op $arg", row.drop(3), actual)
            }
        }
    }

    // A tapper sweeping the cards in reading order, waiting out each hold.
    @Test
    fun onePassOverTheCardsInReadingOrderNeverSolves() {
        repeat(SEEDS) { seed ->
            val rng = TaskRng.seeded(seed.toLong())
            var state = PrayersBoardRun.start(rng)
            for (slot in state.order.deal.indices) {
                PrayersBoardRun.tap(state, slot).state?.let { state = PrayersBoardRun.endHold(it, rng) }
            }
            assertFalse("seed $seed", state.solved)
        }
    }

    @Test
    fun aHoldWithNoWrongCardKeepsTheBoard() {
        val state = PrayersBoardRun.start(TaskRng.seeded(1))
        assertSame(state, PrayersBoardRun.endHold(state, TaskRng.seeded(1)))
    }

    private companion object {
        const val SEEDS = 500
    }
}
