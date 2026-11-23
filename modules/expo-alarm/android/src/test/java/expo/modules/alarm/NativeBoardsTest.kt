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
    fun underReviewALoneDhikrKeepsItsTypedChallenge() {
        for (board in WakeTasks.Board.entries) {
            val shell = NativeBoards.runsShell(stack("id=${board.id}"), dhikrReviewed = false)
            assertEquals(board.id, board != WakeTasks.Board.DHIKR, shell)
        }
    }

    @Test
    fun reviewedEveryLoneTaskRunsTheShell() {
        for (board in WakeTasks.Board.entries) {
            assertTrue(board.id, NativeBoards.runsShell(stack("id=${board.id}"), dhikrReviewed = true))
        }
    }

    @Test
    fun theGateDefaultsToTheReviewFlag() {
        val dhikr = stack("id=${WakeTasks.Board.DHIKR.id}")
        assertEquals(NativeBoards.kindOf(dhikr.single(), DhikrTask.REVIEWED), NativeBoards.kindOf(dhikr.single()))
        assertEquals(NativeBoards.runsShell(dhikr, DhikrTask.REVIEWED), NativeBoards.runsShell(dhikr))
        assertEquals(NativeBoards.shownBoard(dhikr.single(), DhikrTask.REVIEWED), NativeBoards.shownBoard(dhikr.single()))
    }

    @Test
    fun aStoredChallengeWithNoStackRunsTheShellForTapAndMathAndReviewedDhikr() {
        val underReview = setOf(WakeTasks.CHALLENGE_TAP, WakeTasks.CHALLENGE_MATH)
        val reviewed = underReview + WakeTasks.CHALLENGE_DHIKR
        for (type in WakeTasks.CHALLENGE_TYPES) for (difficulty in WakeTasks.DIFFICULTIES) {
            val derived = WakeTasks.resolve(WakeTasks.Challenge(type, difficulty, 3), null)
            assertEquals("$type $difficulty", type in underReview, NativeBoards.runsShell(derived, dhikrReviewed = false))
            assertEquals("$type $difficulty", type in reviewed, NativeBoards.runsShell(derived, dhikrReviewed = true))
        }
    }

    @Test
    fun twoOrMoreTasksRunTheShell() {
        assertTrue(NativeBoards.runsShell(stack("id=math;id=tap")))
        assertTrue(NativeBoards.runsShell(stack("id=dhikr;id=tap")))
        assertTrue(NativeBoards.runsShell(stack("id=pattern;id=prayers;id=dhikr")))
    }

    @Test
    fun underReviewDhikrRunsTapAndEveryOtherTaskItsOwnBoard() {
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
    fun aTaskWithNoNativeBoardShowsTheBoardThatRuns() {
        for ((reviewed, kinds) in listOf(false to KIND_UNDER_REVIEW, true to KIND_REVIEWED)) {
            val own = kinds.filterValues { it != NativeBoards.Kind.TAP }.keys
            for (board in WakeTasks.Board.entries) {
                val task = stack("id=${board.id}").single()
                val shown = NativeBoards.shownBoard(task, reviewed)
                assertEquals("${board.id} $reviewed", if (board in own) board else WakeTasks.Board.TAP, shown)
                assertEquals(
                    "${board.id} $reviewed",
                    NativeBoards.kindOf(task, reviewed),
                    NativeBoards.kindOf(stack("id=${shown.id}").single(), reviewed),
                )
            }
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
            WakeTasks.Board.DHIKR to NativeBoards.Kind.TAP,
        )

        val KIND_REVIEWED = KIND_UNDER_REVIEW + (WakeTasks.Board.DHIKR to NativeBoards.Kind.DHIKR)
    }
}
