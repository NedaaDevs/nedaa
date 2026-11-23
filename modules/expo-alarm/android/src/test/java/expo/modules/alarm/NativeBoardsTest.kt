package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeBoardsTest {

    private fun stack(text: String) = WakeTasks.normalize(WakeTasks.decode(text))

    @Test
    fun noStackKeepsTheSingleChallengeOverlay() {
        assertFalse(NativeBoards.runsShell(emptyList()))
    }

    @Test
    fun aLoneTaskRunsTheShellUnlessItHasNoBoardOfItsOwn() {
        for (board in WakeTasks.Board.entries) {
            assertEquals(board.id, board != WakeTasks.Board.DHIKR, NativeBoards.runsShell(stack("id=${board.id}")))
        }
    }

    @Test
    fun aStoredChallengeWithNoStackRunsTheShellForTapAndMath() {
        val inShell = setOf(WakeTasks.CHALLENGE_TAP, WakeTasks.CHALLENGE_MATH)
        for (type in WakeTasks.CHALLENGE_TYPES) for (difficulty in WakeTasks.DIFFICULTIES) {
            val derived = WakeTasks.resolve(WakeTasks.Challenge(type, difficulty, 3), null)
            assertEquals("$type $difficulty", type in inShell, NativeBoards.runsShell(derived))
        }
    }

    @Test
    fun twoOrMoreTasksRunTheShell() {
        assertTrue(NativeBoards.runsShell(stack("id=math;id=tap")))
        assertTrue(NativeBoards.runsShell(stack("id=dhikr;id=tap")))
        assertTrue(NativeBoards.runsShell(stack("id=pattern;id=prayers;id=dhikr")))
    }

    @Test
    fun mathPrayersAndPatternRunTheirOwnBoardsAndDhikrRunsTap() {
        for (board in WakeTasks.Board.entries) {
            assertEquals(board.id, KIND_OF[board], NativeBoards.kindOf(stack("id=${board.id}").single()))
        }
    }

    @Test
    fun aTaskWithNoNativeBoardShowsTheBoardThatRuns() {
        for (board in WakeTasks.Board.entries) {
            val task = stack("id=${board.id}").single()
            val shown = NativeBoards.shownBoard(task)
            assertEquals(board.id, if (board in OWN_BOARDS) board else WakeTasks.Board.TAP, shown)
            assertEquals(board.id, NativeBoards.kindOf(task), NativeBoards.kindOf(stack("id=${shown.id}").single()))
        }
    }

    @Test
    fun prayersAndPatternAreHeadedByTheirTaskNames() {
        for (board in listOf(WakeTasks.Board.PRAYERS, WakeTasks.Board.PATTERN)) {
            val kind = NativeBoards.kindOf(stack("id=${board.id}").single())
            assertEquals(board.id, TaskBoards.nameOf(board), TaskBoards.headingOf(kind))
        }
    }

    @Test
    fun onlyPatternSaysTheShellsOpening() {
        for (kind in NativeBoards.Kind.entries) {
            assertEquals(kind.name, kind == NativeBoards.Kind.PATTERN, NativeBoards.saysOpening(kind))
        }
    }

    private companion object {
        val KIND_OF = mapOf(
            WakeTasks.Board.MATH to NativeBoards.Kind.MATH_CARDS,
            WakeTasks.Board.TAP to NativeBoards.Kind.TAP,
            WakeTasks.Board.PATTERN to NativeBoards.Kind.PATTERN,
            WakeTasks.Board.PRAYERS to NativeBoards.Kind.PRAYERS,
            WakeTasks.Board.DHIKR to NativeBoards.Kind.TAP,
        )

        // The tasks with a board of their own, read from the expected kinds.
        val OWN_BOARDS = KIND_OF.filterValues { it != NativeBoards.Kind.TAP }.keys
    }
}
