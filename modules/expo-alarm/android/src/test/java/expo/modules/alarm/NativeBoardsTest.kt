package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeBoardsTest {

    private fun stack(text: String) = WakeTasks.normalize(WakeTasks.decode(text))

    @Test
    fun noStackShowsOnlyTheDismiss() {
        assertFalse(NativeBoards.runsShell(emptyList()))
    }

    @Test
    fun everyLoneTaskRunsTheShell() {
        for (board in WakeTasks.Board.entries) {
            assertTrue(board.id, NativeBoards.runsShell(stack("id=${board.id}")))
        }
    }

    @Test
    fun theGateDefaultsToTheReviewFlag() {
        val dhikr = stack("id=${WakeTasks.Board.DHIKR.id}")
        assertEquals(NativeBoards.kindOf(dhikr.single(), DhikrTask.REVIEWED), NativeBoards.kindOf(dhikr.single()))
    }

    // Only "none" stores no stack, so only it keeps the plain dismiss.
    @Test
    fun aStoredChallengeWithNoStackRunsTheShellUnlessItIsNone() {
        for (type in WakeTasks.CHALLENGE_TYPES) for (difficulty in WakeTasks.DIFFICULTIES) {
            val derived = WakeTasks.resolve(WakeTasks.Challenge(type, difficulty, 3), null)
            assertEquals("$type $difficulty", type != WakeTasks.CHALLENGE_NONE, NativeBoards.runsShell(derived))
        }
    }

    @Test
    fun twoOrMoreTasksRunTheShell() {
        assertTrue(NativeBoards.runsShell(stack("id=math;id=tap")))
        assertTrue(NativeBoards.runsShell(stack("id=dhikr;id=tap")))
        assertTrue(NativeBoards.runsShell(stack("id=pattern;id=prayers;id=dhikr")))
    }

    @Test
    fun underReviewDhikrTypesItsPhraseAndEveryOtherTaskRunsItsOwnBoard() {
        for (board in WakeTasks.Board.entries) {
            val kind = NativeBoards.kindOf(stack("id=${board.id}").single(), dhikrReviewed = false)
            assertEquals(board.id, KIND_UNDER_REVIEW[board], kind)
        }
    }

    @Test
    fun reviewedDhikrRunsItsOwnBoard() {
        for (board in WakeTasks.Board.entries) {
            val kind = NativeBoards.kindOf(stack("id=${board.id}").single(), dhikrReviewed = true)
            assertEquals(board.id, KIND_REVIEWED[board], kind)
        }
    }

    @Test
    fun prayersPatternAndDhikrAreHeadedByTheirTaskNames() {
        for (board in listOf(WakeTasks.Board.PRAYERS, WakeTasks.Board.PATTERN, WakeTasks.Board.DHIKR)) {
            val kind = NativeBoards.kindOf(stack("id=${board.id}").single(), dhikrReviewed = true)
            assertEquals(board.id, TaskBoards.nameOf(board), TaskBoards.headingOf(kind))
        }
    }

    @Test
    fun theTypedDhikrIsHeadedByTheTaskName() {
        assertEquals(TaskBoards.nameOf(WakeTasks.Board.DHIKR), TaskBoards.headingOf(NativeBoards.Kind.DHIKR_TYPED))
    }

    @Test
    fun onlyTheTypedDhikrTakesTyping() {
        for (kind in NativeBoards.Kind.entries) {
            assertEquals(kind.name, kind == NativeBoards.Kind.DHIKR_TYPED, NativeBoards.takesTyping(kind))
        }
    }

    @Test
    fun onlyPatternSaysTheShellsOpening() {
        for (kind in NativeBoards.Kind.entries) {
            assertEquals(kind.name, kind == NativeBoards.Kind.PATTERN, NativeBoards.saysOpening(kind))
        }
    }

    private companion object {
        val KIND_UNDER_REVIEW = mapOf(
            WakeTasks.Board.MATH to NativeBoards.Kind.MATH_CARDS,
            WakeTasks.Board.TAP to NativeBoards.Kind.TAP,
            WakeTasks.Board.PATTERN to NativeBoards.Kind.PATTERN,
            WakeTasks.Board.PRAYERS to NativeBoards.Kind.PRAYERS,
            WakeTasks.Board.DHIKR to NativeBoards.Kind.DHIKR_TYPED,
        )

        val KIND_REVIEWED = KIND_UNDER_REVIEW + (WakeTasks.Board.DHIKR to NativeBoards.Kind.DHIKR)
    }
}
