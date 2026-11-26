package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

// math-board.tsv holds what the JS mathBoard rules do for each script of taps.
class MathBoardRunTest {

    private val rows = sharedTable("math-board.tsv")

    private fun outcomeOf(tap: MathTap): String = when (tap) {
        is MathTap.Solved -> FixtureOutcome.SOLVED
        is MathTap.Wrong -> FixtureOutcome.WRONG
        MathTap.Ignored -> FixtureOutcome.IGNORED
    }

    private fun shown(state: MathBoardState): List<String> = listOf(
        "${state.round.question.left},${state.round.question.right}",
        state.round.cards.joinToString(","),
        state.round.cards.indices.joinToString(",") { state.cardState(it).id },
        state.line.id,
        state.asked.toString(),
    )

    @Test
    fun everyScriptMatchesJs() {
        for ((name, caseRows) in rows.groupBy { it[0] }) {
            var rng: TaskRng.Rng? = null
            var state: MathBoardState? = null
            for (row in caseRows) {
                val (_, id, op, arg, outcome) = row
                val difficulty = checkNotNull(ChallengeDifficulty.fromId(id))
                var said = FIXTURE_NONE
                state = when (op) {
                    FixtureOp.START -> MathBoardRun.start(difficulty, TaskRng.seeded(arg.toLong()).also { rng = it })
                    FixtureOp.STEP -> MathBoardRun.start(difficulty, checkNotNull(rng))
                    FixtureOp.TAP -> {
                        val tap = MathBoardRun.tap(checkNotNull(state), arg.toInt())
                        said = outcomeOf(tap)
                        tap.state ?: state
                    }
                    FixtureOp.REPLACE -> MathBoardRun.replace(checkNotNull(state), difficulty, checkNotNull(rng))
                    else -> error("unknown op $op")
                }
                assertEquals("$name $op $arg", listOf(outcome) + row.drop(5), listOf(said) + shown(state))
            }
        }
    }

    @Test
    fun theTableCoversEveryDifficultyOutcomeAndCard() {
        assertEquals(ChallengeDifficulty.entries.map { it.id }.toSet(), rows.map { it[1] }.toSet())
        val outcomes = setOf(FIXTURE_NONE, FixtureOutcome.SOLVED, FixtureOutcome.WRONG, FixtureOutcome.IGNORED)
        assertEquals(outcomes, rows.map { it[4] }.toSet())
        val missed = rows.filter { it[4] == FixtureOutcome.WRONG }.map { it[3].toInt() }.toSet()
        assertEquals((0 until MathCards.CARD_COUNT).toSet(), missed)
    }

    @Test
    fun tappingTheFourCardsInTurnSolvesOnlyOnTheFirst() {
        for (difficulty in ChallengeDifficulty.entries) {
            for (seed in 1L..200L) {
                val rng = TaskRng.seeded(seed)
                var state = MathBoardRun.start(difficulty, rng)
                val first = state.round.answer
                val taps = (0 until MathCards.CARD_COUNT).map { position ->
                    MathBoardRun.tap(state, position).also { tap -> tap.state?.let { state = it } }
                }
                assertTrue("$difficulty $seed", taps.drop(1).all { it == MathTap.Ignored })
                if (taps[0] is MathTap.Wrong) {
                    assertNotEquals(first, MathBoardRun.replace(state, difficulty, rng).round.answer)
                }
            }
        }
    }

    @Test
    fun replaceWithNoCardHeldKeepsTheBoard() {
        val state = MathBoardRun.start(ChallengeDifficulty.EASY, TaskRng.seeded(4))
        assertSame(state, MathBoardRun.replace(state, ChallengeDifficulty.EASY, TaskRng.seeded(4)))
    }
}
