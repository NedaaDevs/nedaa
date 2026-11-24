package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TaskShellRunTest {

    private val opened = 1_000L
    private val quietMs = TaskClock.QUIET_SECONDS * TaskClock.SECOND_MS

    private fun run(text: String) = TaskShellRun(WakeTasks.normalize(WakeTasks.decode(text)), quietMs, opened)

    // Reads every tick up to `to`, returning the signals sent.
    private fun TaskShellRun.ticks(to: Long): List<TaskQuiet.Signal> {
        val sent = mutableListOf<TaskQuiet.Signal>()
        var at = reading.now + TaskClock.TICK_MS
        while (at <= to) {
            tick(at)?.let { sent += it }
            at += TaskClock.TICK_MS
        }
        return sent
    }

    @Test
    fun onlyAStackOfTwoOrMoreShowsWhichTaskIsRunning() {
        assertFalse(run("id=pattern,difficulty=easy,steps=3").showsTaskLine)
        assertTrue(run("id=math;id=tap").showsTaskLine)
        assertTrue(run("id=math;id=tap;id=prayers").showsTaskLine)
    }

    @Test
    fun openingPausesTheSound() {
        assertEquals(TaskQuiet.Signal.START, run("id=math;id=tap").open())
    }

    @Test
    fun runsStepsThenAHandoverThenTheNextTaskThenEnds() {
        val run = run("id=math,difficulty=easy,steps=2;id=tap")
        run.open()
        val step = run.solved(opened + 1_000, quietMs)
        assertEquals(TaskRun.Advance.Step(TaskRun.Position(0, 1)), step?.advance)
        assertNull("quiet time restarts with no second pause", step?.signal)
        assertEquals(TaskRun.Position(0, 1), run.position)

        val handover = run.solved(opened + 2_000, quietMs)
        assertEquals(TaskRun.Advance.Handover(TaskRun.Position(1, 0)), handover?.advance)
        assertEquals(TaskRun.Position(0, 1), run.position)
        assertNull("no board takes a solve during the handover", run.solved(opened + 2_100, quietMs))

        run.finishHandover(opened + 3_000, quietMs)
        assertNull(run.handover)
        assertEquals(TaskRun.Position(1, 0), run.position)
        assertEquals(WakeTasks.Board.TAP, run.task.board)
        assertEquals(opened + 3_000 + quietMs, run.reading.clock.quietUntil)

        assertEquals(TaskRun.Advance.Done, run.solved(opened + 4_000, quietMs)?.advance)
        assertTrue(run.done)
        assertNull("a stopped alarm takes no more solves", run.solved(opened + 4_100, quietMs))
    }

    @Test
    fun aSolveAfterTheSoundReturnedPausesItAgain() {
        val run = run("id=math,steps=2;id=tap")
        run.open()
        assertEquals(listOf(TaskQuiet.Signal.ENDING, TaskQuiet.Signal.END), run.ticks(opened + quietMs))
        assertEquals(TaskQuiet.Signal.START, run.solved(opened + quietMs + 1_000, quietMs)?.signal)
    }

    @Test
    fun theWayOutComesAfterTwoMinutesOfSoundAndASolveKeepsIt() {
        val run = run("id=tap;id=math")
        run.open()
        run.ticks(opened + quietMs + 119_750)
        assertFalse(run.wayOut)
        run.ticks(opened + quietMs + 120_000)
        assertTrue(run.wayOut)
        run.solved(opened + quietMs + 121_000, quietMs)
        assertTrue(run.wayOut)
    }

    @Test
    fun aDoneRunSendsNoSoundChangeAndOffersNoWayOut() {
        val run = run("id=tap;id=math")
        run.open()
        run.ticks(opened + quietMs + 120_000)
        run.solved(opened + quietMs + 120_000, quietMs)
        run.finishHandover(opened + quietMs + 121_000, quietMs)
        run.solved(opened + quietMs + 122_000, quietMs)
        assertTrue(run.done)
        assertFalse(run.wayOut)
        assertEquals(emptyList<TaskQuiet.Signal>(), run.ticks(opened + 10 * quietMs))
    }

    @Test
    fun aSolveIntoAHandoverRestartsQuietBeforeTheNextBoardShows() {
        val run = run("id=tap;id=math")
        run.open()
        run.ticks(opened + quietMs)
        val at = opened + quietMs + 1_000
        val handover = run.solved(at, quietMs)
        assertEquals(TaskRun.Advance.Handover(TaskRun.Position(1, 0)), handover?.advance)
        assertEquals(TaskQuiet.Signal.START, handover?.signal)
        assertEquals(at + quietMs, run.reading.clock.quietUntil)
        assertNull("quiet is already running", run.finishHandover(at + 1_180, quietMs))
    }

    @Test
    fun eachRestartTakesTheQuietLengthReadThen() {
        val longer = TaskClock.QUIET_SECONDS_SCREEN_READER * TaskClock.SECOND_MS
        val run = run("id=math,steps=2;id=tap")
        run.open()
        run.solved(opened + 1_000, longer)
        assertEquals(opened + 1_000 + longer, run.reading.clock.quietUntil)
        run.solved(opened + 2_000, quietMs)
        run.finishHandover(opened + 3_000, longer)
        assertEquals(opened + 3_000 + longer, run.reading.clock.quietUntil)
    }

    @Test
    fun aTaskKeepsWhatItsEarlierStepsDrew() {
        val run = run("id=math,steps=3;id=tap")
        run.draw(4)
        run.solved(opened + 1_000, quietMs)
        run.draw(7)
        assertEquals(listOf(4, 7), run.drawn)
    }

    @Test
    fun saysNothingOnTheFirstStep() {
        assertEquals(TaskShellRun.Spoken.Silent, TaskShellRun.spokenProgress(null, TaskRun.FIRST, done = false, saysOpening = false))
    }

    @Test
    fun saysTheStepLineFromTheSecondStep() {
        val second = TaskRun.Position(0, 1)
        assertEquals(TaskShellRun.Spoken.Step(second), TaskShellRun.spokenProgress(null, second, done = false, saysOpening = false))
    }

    @Test
    fun aBoardThatSaysItsOpeningTakesTheStepLine() {
        val second = TaskRun.Position(0, 1)
        assertEquals(TaskShellRun.Spoken.Silent, TaskShellRun.spokenProgress(null, second, done = false, saysOpening = true))
    }

    @Test
    fun theHandoverIsSaidInsteadOfTheStepLine() {
        val next = TaskRun.Position(1, 0)
        assertEquals(
            TaskShellRun.Spoken.Handover(next),
            TaskShellRun.spokenProgress(next, TaskRun.Position(0, 1), done = false, saysOpening = true),
        )
    }

    @Test
    fun saysNothingOnceDone() {
        assertEquals(TaskShellRun.Spoken.Silent, TaskShellRun.spokenProgress(null, TaskRun.Position(0, 1), done = true, saysOpening = false))
    }

    @Test
    fun aRunSaysEachStepThenTheHandoverThenNothingOnTheNextTask() {
        val run = run("id=math,difficulty=easy,steps=2;id=tap")
        run.open()
        val said = { TaskShellRun.spokenProgress(run.handover, run.position, run.done, saysOpening = false) }
        assertEquals(TaskShellRun.Spoken.Silent, said())
        run.solved(opened + 1_000, quietMs)
        assertEquals(TaskShellRun.Spoken.Step(TaskRun.Position(0, 1)), said())
        run.solved(opened + 2_000, quietMs)
        assertEquals(TaskShellRun.Spoken.Handover(TaskRun.Position(1, 0)), said())
        run.finishHandover(opened + 3_000, quietMs)
        assertEquals(TaskShellRun.Spoken.Silent, said())
    }

    @Test
    fun aStepPastTheFirstIsSaidByTheShellOrTheBoardNeverBothOrNeither() {
        for (step in 0..2) for (done in listOf(false, true)) for (saysOpening in listOf(false, true)) {
            val position = TaskRun.Position(0, step)
            val shell = TaskShellRun.spokenProgress(null, position, done, saysOpening) is TaskShellRun.Spoken.Step
            val board = TaskShellRun.openingAt(position, done, saysOpening) != null
            assertEquals("$step $done $saysOpening", step > 0 && !done, shell != board)
            assertFalse("$step $done $saysOpening", shell && board)
            assertEquals("$step $done $saysOpening", saysOpening && step > 0 && !done, board)
        }
    }

    @Test
    fun leavingInQuietReturnsTheSoundAndReopeningAddsNoQuiet() {
        val tasks = WakeTasks.normalize(WakeTasks.decode("id=math;id=tap"))
        val run = TaskShellRun(tasks, quietMs, opened)
        run.open()
        val left = checkNotNull(run.leave(opened + 4_000))
        assertEquals(TaskQuiet.Signal.END, left.signal)
        assertEquals(opened + 4_000, left.saved.clock.quietUntil)

        val back = opened + 100_000
        val again = TaskShellRun(tasks, quietMs, back, left.saved)
        assertNull("the sound is already back", again.open())
        assertEquals(opened + 4_000, again.reading.clock.quietUntil)
        again.ticks(back + 1_000)
        assertEquals("closed time counts nothing", 1_000L, again.reading.clock.soundingMs)
    }

    @Test
    fun leavingWhileItSoundsChangesNothing() {
        val run = run("id=math;id=tap")
        run.open()
        run.ticks(opened + quietMs)
        val left = checkNotNull(run.leave(opened + quietMs + 1_000))
        assertNull(left.signal)
    }

    @Test
    fun reopeningResumesAtTheStepLeft() {
        val tasks = WakeTasks.normalize(WakeTasks.decode("id=math,steps=3;id=tap"))
        val run = TaskShellRun(tasks, quietMs, opened)
        run.open()
        run.solved(opened + 1_000, quietMs)
        val saved = checkNotNull(run.leave(opened + 2_000)).saved
        assertEquals(TaskRun.Position(0, 1), TaskShellRun(tasks, quietMs, opened + 9_000, saved).position)
    }

    @Test
    fun leavingDuringAHandoverResumesAtTheNextTask() {
        val tasks = WakeTasks.normalize(WakeTasks.decode("id=tap;id=math"))
        val run = TaskShellRun(tasks, quietMs, opened)
        run.open()
        run.solved(opened + 1_000, quietMs)
        val saved = checkNotNull(run.leave(opened + 1_100)).saved
        val again = TaskShellRun(tasks, quietMs, opened + 9_000, saved)
        assertEquals(TaskRun.Position(1, 0), again.position)
        assertNull(again.handover)
        assertEquals(WakeTasks.Board.MATH, again.task.board)
    }

    @Test
    fun reopeningKeepsWhatEarlierStepsDrew() {
        val tasks = WakeTasks.normalize(WakeTasks.decode("id=math,steps=3;id=tap"))
        val run = TaskShellRun(tasks, quietMs, opened)
        run.draw(4)
        run.solved(opened + 1_000, quietMs)
        val saved = checkNotNull(run.leave(opened + 2_000)).saved
        assertEquals(listOf(4), TaskShellRun(tasks, quietMs, opened + 9_000, saved).drawn)
    }

    @Test
    fun aDoneRunHasNoWayBack() {
        val run = run("id=tap")
        run.open()
        run.solved(opened + 1_000, quietMs)
        assertTrue(run.done)
        assertNull(run.leave(opened + 2_000))
    }
}
