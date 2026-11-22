package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

// prayer-order.tsv: each case plays one board with one seeded rng, as the
// JS test does: a deal, taps, and a redeal after each wrong card.
class PrayerOrderTest {

    private val cases = sharedTable("prayer-order.tsv").groupBy { it[0] }

    // The JS outcome word, and the board a tap moved on to, if any.
    private fun read(tap: PrayerTap): Pair<String, PrayerBoardState?> = when (tap) {
        is PrayerTap.Placed -> FixtureOutcome.PLACED to tap.state
        is PrayerTap.Done -> FixtureOutcome.DONE to tap.state
        PrayerTap.Wrong -> FixtureOutcome.WRONG to null
        PrayerTap.Ignored -> FixtureOutcome.IGNORED to null
    }

    @Test
    fun everyCaseMatchesJs() {
        for ((name, rows) in cases) {
            var rng: TaskRng.Rng? = null
            var state: PrayerBoardState? = null
            for ((op, arg, outcome, deal, placed) in rows.map { it.drop(1) }) {
                var said = FIXTURE_NONE
                when (op) {
                    FixtureOp.START -> {
                        val seeded = TaskRng.seeded(arg.toLong())
                        rng = seeded
                        state = PrayerOrder.startBoard(seeded)
                    }
                    FixtureOp.TAP -> {
                        val (word, moved) = read(PrayerOrder.tap(checkNotNull(state), arg.toInt()))
                        said = word
                        state = moved ?: state
                    }
                    FixtureOp.RESHUFFLE ->
                        state = PrayerOrder.reshuffleUnplaced(checkNotNull(state), checkNotNull(rng))
                    else -> error("unknown op $op")
                }
                val board = checkNotNull(state)
                val actual = listOf(said, board.deal.joinToString(",") { it.id }, board.placed.toString())
                assertEquals("$name: $op $arg", listOf(outcome, deal, placed), actual)
            }
        }
    }

    @Test
    fun aDealIsNeverAlreadyInOrder() {
        val rng = TaskRng.seeded(4)
        repeat(2000) {
            assertNotEquals(PrayerId.entries, PrayerOrder.dealPrayers(rng))
        }
    }

    @Test
    fun orderingAtWalksEveryOrderingOnce() {
        val items = listOf(1, 2, 3, 4)
        val orderings = (1..items.size).fold(1) { product, n -> product * n }
        val all = (0 until orderings).map { PrayerOrder.orderingAt(items, it) }
        assertEquals(items, all.first())
        assertEquals(orderings, all.toSet().size)
    }
}
