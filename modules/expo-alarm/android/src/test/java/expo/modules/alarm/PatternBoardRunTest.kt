package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

// Phases, pad looks, lines and words, as JS PatternBoard shows them.
class PatternBoardRunTest {

    private val difficulty = ChallengeDifficulty.MEDIUM

    private fun start(seed: Long = 7) = PatternBoardRun.start(difficulty, TaskRng.seeded(seed))

    // Plays the whole order through to the open turn.
    private fun played(state: PatternBoardState): PatternBoardState {
        var shown = state
        while (shown.phase == PatternPhase.WATCHING) shown = PatternBoardRun.advance(shown)
        return shown
    }

    private fun wrongPad(state: PatternBoardState): PatternPad =
        PatternPad.entries.first { it != state.board.pattern[state.board.done] }

    @Test
    fun anOrderPlaysFromItsStartAndTakesNoTap() {
        val state = start()
        assertEquals(PatternPhase.WATCHING, state.phase)
        assertEquals(0, state.step)
        assertEquals(PatternOrder.lengthOf(difficulty), state.total)
        for (pad in PatternPad.entries) assertEquals(PatternBoardTap.Ignored, PatternBoardRun.tap(state, pad))
    }

    @Test
    fun eachPadLightsInTurnThenTheTurnOpens() {
        var state = start()
        val lit = mutableListOf<PatternPad>()
        while (state.phase == PatternPhase.WATCHING) {
            val litNow = PatternPad.entries.filter { state.padState(it) == PatternPadState.LIT }
            assertTrue(litNow.size <= 1)
            lit += litNow
            for (pad in PatternPad.entries - litNow.toSet()) assertEquals(PatternPadState.HELD, state.padState(pad))
            state = PatternBoardRun.advance(state)
        }
        assertEquals(state.board.pattern, lit)
        assertEquals(PatternPhase.REPEATING, state.phase)
        for (pad in PatternPad.entries) assertEquals(PatternPadState.REST, state.padState(pad))
        assertEquals(state, PatternBoardRun.advance(state))
    }

    @Test
    fun theLineCountsTheLightsThenTheTaps() {
        var state = start()
        assertEquals(PatternLine.Showing(at = 1, total = 4, new = false), state.line)
        assertEquals(0, state.filled)
        state = PatternBoardRun.advance(state)
        assertEquals(PatternLine.Showing(at = 1, total = 4, new = false), state.line)
        assertEquals(1, state.filled)
        state = PatternBoardRun.advance(PatternBoardRun.advance(state))
        assertEquals(PatternLine.Showing(at = 2, total = 4, new = false), state.line)
        state = played(state)
        assertEquals(PatternLine.Turn(done = 0, total = 4), state.line)
        assertEquals(0, state.filled)
    }

    @Test
    fun rightTapsCountAndTheLastSolvesOnce() {
        var state = played(start())
        val pattern = state.board.pattern
        pattern.dropLast(1).forEachIndexed { index, pad ->
            val tap = PatternBoardRun.tap(state, pad) as PatternBoardTap.Next
            state = tap.state
            assertEquals(index + 1, state.board.done)
            assertEquals(PatternLine.Turn(done = index + 1, total = 4), state.line)
            assertEquals(index + 1, state.filled)
        }
        val done = PatternBoardRun.tap(state, pattern.last()) as PatternBoardTap.Done
        assertTrue(done.state.solved)
        assertEquals(PatternPhase.SOLVED, done.state.phase)
        assertEquals(PatternLine.Done, done.state.line)
        for (pad in PatternPad.entries) {
            assertEquals(PatternPadState.HELD, done.state.padState(pad))
            assertEquals(PatternBoardTap.Ignored, PatternBoardRun.tap(done.state, pad))
        }
        assertFalse(done.state.replayable)
    }

    @Test
    fun aWrongPadIsMarkedAndEveryOtherHeld() {
        val state = played(start())
        val pad = wrongPad(state)
        val held = (PatternBoardRun.tap(state, pad) as PatternBoardTap.Wrong).state
        assertEquals(PatternPhase.WRONG, held.phase)
        assertEquals(PatternLine.Wrong, held.line)
        assertEquals(PatternStatus.Wrong, held.status)
        for (other in PatternPad.entries) {
            assertEquals(if (other == pad) PatternPadState.WRONG else PatternPadState.HELD, held.padState(other))
            assertEquals(PatternBoardTap.Ignored, PatternBoardRun.tap(held, other))
        }
        assertFalse(held.replayable)
    }

    @Test
    fun aWrongPadAfterAMissStillSaysWrongAndOffersNoReplay() {
        val rng = TaskRng.seeded(3)
        val first = played(PatternBoardRun.start(difficulty, rng))
        val held = (PatternBoardRun.tap(first, wrongPad(first)) as PatternBoardTap.Wrong).state
        val again = played(PatternBoardRun.endHold(held, difficulty, rng))
        assertEquals(PatternStatus.AfterMiss, again.status)
        val heldAgain = (PatternBoardRun.tap(again, wrongPad(again)) as PatternBoardTap.Wrong).state
        assertTrue(heldAgain.missed)
        assertEquals(PatternStatus.Wrong, heldAgain.status)
        assertFalse(heldAgain.replayable)
    }

    @Test
    fun theHoldEndsWithANewOrderPlayedFromItsStart() {
        // A constant source draws rank 0 each time; only the last order moves it on.
        val rng = TaskRng.Rng { 0.0 }
        val first = played(PatternBoardRun.start(difficulty, rng))
        val tapped = (PatternBoardRun.tap(first, first.board.pattern[0]) as PatternBoardTap.Next).state
        val held = (PatternBoardRun.tap(tapped, wrongPad(tapped)) as PatternBoardTap.Wrong).state
        val next = PatternBoardRun.endHold(held, difficulty, rng)
        assertEquals(PatternOrder.patternAt(first.total, 0), first.board.pattern)
        assertEquals(PatternOrder.patternAt(first.total, 1), next.board.pattern)
        assertEquals(0, next.board.done)
        assertEquals(0, next.step)
        assertEquals(1, next.plays)
        assertNull(next.wrong)
        assertTrue(next.missed)
        assertEquals(PatternPhase.WATCHING, next.phase)
        assertEquals(PatternLine.Showing(at = 1, total = 4, new = true), next.line)
        assertEquals(PatternStatus.AfterMiss, next.status)
    }

    @Test
    fun endingAHoldThatIsNotThereChangesNothing() {
        val state = played(start())
        assertEquals(state, PatternBoardRun.endHold(state, difficulty, TaskRng.seeded(1)))
    }

    @Test
    fun theNextRightTapClearsTheMiss() {
        val rng = TaskRng.seeded(3)
        val state = played(PatternBoardRun.start(difficulty, rng))
        val held = (PatternBoardRun.tap(state, wrongPad(state)) as PatternBoardTap.Wrong).state
        val again = played(PatternBoardRun.endHold(held, difficulty, rng))
        assertEquals(PatternStatus.AfterMiss, again.status)
        val right = (PatternBoardRun.tap(again, again.board.pattern[0]) as PatternBoardTap.Next).state
        assertFalse(right.missed)
        assertEquals(PatternStatus.Watch(first = false), right.status)
    }

    @Test
    fun onlyTheFirstOrderCarriesTheOpeningLine() {
        val state = start()
        assertEquals(PatternStatus.Watch(first = true), state.status)
        assertEquals(PatternStatus.Watch(first = true), played(state).status)
    }

    @Test
    fun theOrderCanBeHeardAgainWhileItPlaysOrIsRepeated() {
        val state = start()
        assertTrue(state.replayable)
        assertTrue(PatternBoardRun.advance(state).replayable)
        assertTrue(played(state).replayable)
    }

    @Test
    fun aReaderTurnedOnMidOrderPlaysItAgainFromItsStart() {
        val midway = PatternBoardRun.advance(PatternBoardRun.advance(PatternBoardRun.advance(start())))
        val restarted = PatternBoardRun.readerChanged(midway)
        assertEquals(0, restarted.step)
        assertEquals(midway.board, restarted.board)
        assertEquals(midway.plays, restarted.plays)
    }

    @Test
    fun aReaderTurnedOnDuringTheTurnKeepsThePadsTapped() {
        val state = played(start())
        val tapped = (PatternBoardRun.tap(state, state.board.pattern[0]) as PatternBoardTap.Next).state
        assertEquals(tapped, PatternBoardRun.readerChanged(tapped))
    }
}
