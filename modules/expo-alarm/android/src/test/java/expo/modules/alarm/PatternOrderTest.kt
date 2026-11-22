package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

// pattern-order.tsv plays each board with one seeded rng, as the JS test
// does; pattern-playback.tsv holds the playback times and frames.
class PatternOrderTest {

    // The JS outcome word, and the board a tap moved on to, if any.
    private fun read(tap: PatternTap): Pair<String, PatternState?> = when (tap) {
        is PatternTap.Next -> FixtureOutcome.NEXT to tap.state
        is PatternTap.Done -> FixtureOutcome.DONE to tap.state
        PatternTap.Wrong -> FixtureOutcome.WRONG to null
    }

    @Test
    fun everyBoardMatchesJs() {
        for ((name, rows) in sharedTable("pattern-order.tsv").groupBy { it[0] }) {
            var rng: TaskRng.Rng? = null
            var state: PatternState? = null
            for ((op, arg, outcome, pattern, done) in rows.map { it.drop(1) }) {
                var said = FIXTURE_NONE
                when (op) {
                    FixtureOp.DRAW -> {
                        val (id, seed) = arg.split(':')
                        val seeded = TaskRng.seeded(seed.toLong())
                        rng = seeded
                        state = PatternState(PatternOrder.draw(difficultyOf(id), seeded), 0)
                    }
                    FixtureOp.REDRAW -> {
                        val previous = checkNotNull(state).pattern
                        val drawn = PatternOrder.draw(difficultyOf(arg), checkNotNull(rng), previous)
                        state = PatternState(drawn, 0)
                    }
                    FixtureOp.TAP -> {
                        val pad = PatternPad.entries.first { it.id == arg }
                        val (word, moved) = read(PatternOrder.tap(checkNotNull(state), pad))
                        said = word
                        state = moved ?: state
                    }
                    else -> error("unknown op $op")
                }
                val board = checkNotNull(state)
                val actual = listOf(said, board.pattern.joinToString(",") { it.id }, board.done.toString())
                assertEquals("$name: $op $arg", listOf(outcome, pattern, done), actual)
            }
        }
    }

    private fun difficultyOf(id: String) = checkNotNull(ChallengeDifficulty.fromId(id))

    @Test
    fun playbackMatchesJs() {
        for ((reduceMotion, screenReader, length, starts, frames) in sharedTable("pattern-playback.tsv")) {
            val timing = PatternOrder.playbackTiming(
                reduceMotion = reduceMotion.toBooleanStrict(),
                screenReader = screenReader.toBooleanStrict(),
            )
            val size = length.toInt()
            val label = "motion $reduceMotion reader $screenReader length $length"
            assertEquals(label, starts.split(',').map { it.toLong() }, PatternOrder.playbackStarts(size, timing))
            val shown = (0..2 * size + 1).map { step ->
                val frame = PatternOrder.playbackFrame(step, size)
                "${frame.lit ?: FIXTURE_NONE}/${frame.shown}/${frame.playing}"
            }
            assertEquals(label, frames.split(','), shown)
        }
    }

    @Test
    fun aRedrawNeverRepeatsTheLastOrder() {
        for (difficulty in ChallengeDifficulty.entries) {
            val rng = TaskRng.seeded(17)
            var pattern = PatternOrder.draw(difficulty, rng)
            repeat(500) {
                val next = PatternOrder.draw(difficulty, rng, pattern)
                assertNotEquals(pattern, next)
                pattern = next
            }
        }
    }

    @Test
    fun rankOfUndoesPatternAt() {
        val length = 3
        for (rank in 0 until PatternOrder.patternCount(length)) {
            assertEquals(rank, PatternOrder.rankOf(PatternOrder.patternAt(length, rank)))
        }
    }
}
