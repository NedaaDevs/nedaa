package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeBoardsTest {

    private fun stack(text: String) = WakeTasks.normalize(WakeTasks.decode(text))

    @Test
    fun noStackOrOneTaskKeepsTheSingleChallengeOverlay() {
        assertFalse(NativeBoards.runsShell(emptyList()))
        for (board in WakeTasks.Board.entries) {
            assertFalse(board.id, NativeBoards.runsShell(stack("id=${board.id}")))
        }
        // A NULL stored stack resolves to the one task its challenge stands for.
        for (type in WakeTasks.CHALLENGE_TYPES) for (difficulty in WakeTasks.DIFFICULTIES) {
            val derived = WakeTasks.resolve(WakeTasks.Challenge(type, difficulty, 3), null)
            assertFalse("$type $difficulty", NativeBoards.runsShell(derived))
        }
    }

    @Test
    fun twoOrMoreTasksRunTheShell() {
        assertTrue(NativeBoards.runsShell(stack("id=math;id=tap")))
        assertTrue(NativeBoards.runsShell(stack("id=pattern;id=prayers;id=dhikr")))
    }

    @Test
    fun mathAndPrayersRunTheirOwnBoardsAndEveryOtherTaskRunsTap() {
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
    fun prayersIsHeadedByItsTaskName() {
        assertEquals(TaskBoards.nameOf(WakeTasks.Board.PRAYERS), TaskBoards.headingOf(NativeBoards.Kind.PRAYERS))
    }

    private companion object {
        val KIND_OF = mapOf(
            WakeTasks.Board.MATH to NativeBoards.Kind.MATH_CARDS,
            WakeTasks.Board.TAP to NativeBoards.Kind.TAP,
            WakeTasks.Board.PATTERN to NativeBoards.Kind.TAP,
            WakeTasks.Board.PRAYERS to NativeBoards.Kind.PRAYERS,
            WakeTasks.Board.DHIKR to NativeBoards.Kind.TAP,
        )

        // The tasks with a board of their own, read from the expected kinds.
        val OWN_BOARDS = KIND_OF.filterValues { it != NativeBoards.Kind.TAP }.keys
    }
}
