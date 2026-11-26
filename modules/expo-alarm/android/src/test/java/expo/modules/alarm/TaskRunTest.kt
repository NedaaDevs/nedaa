package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

// task-run.tsv: what solving the board at each position of a stack leads to.
// task-start.tsv: what the start button says for each stack.
// task-resume.tsv: where a reopened run starts from a saved position.
// task-leave.tsv: the position a left run saves.
class TaskRunTest {

    private fun shown(advance: TaskRun.Advance): List<String> = when (advance) {
        is TaskRun.Advance.Step -> listOf(advance.next.id, "${advance.position.task}", "${advance.position.step}")
        is TaskRun.Advance.Handover -> listOf(advance.next.id, "${advance.position.task}", "${advance.position.step}")
        TaskRun.Advance.Done -> listOf(advance.next.id, FIXTURE_NONE, FIXTURE_NONE)
    }

    @Test
    fun everyPositionMatchesJs() {
        val rows = sharedTable("task-run.tsv")
        check(rows.isNotEmpty())
        for (row in rows) {
            val (stack, task, step) = row
            val tasks = WakeTasks.normalize(WakeTasks.decode(stack))
            val advance = TaskRun.advance(tasks, TaskRun.Position(task.toInt(), step.toInt()))
            assertEquals("$stack at $task.$step", row.subList(3, 6), shown(advance))
        }
    }

    @Test
    fun everyResumeMatchesJs() {
        val rows = sharedTable("task-resume.tsv")
        check(rows.isNotEmpty())
        for (row in rows) {
            val (stack, task, step) = row
            val tasks = WakeTasks.normalize(WakeTasks.decode(stack))
            val saved = if (task == FIXTURE_NONE) null else TaskRun.Position(task.toInt(), step.toInt())
            val resumed = TaskRun.resume(tasks, saved)
            assertEquals("$stack from $task.$step", row.subList(3, 5), listOf("${resumed.task}", "${resumed.step}"))
        }
    }

    @Test
    fun everyLeaveMatchesJs() {
        val rows = sharedTable("task-leave.tsv")
        check(rows.isNotEmpty())
        for (row in rows) {
            val (task, step, handoverTask, handoverStep) = row
            val handover =
                if (handoverTask == FIXTURE_NONE) null else TaskRun.Position(handoverTask.toInt(), handoverStep.toInt())
            val saved = TaskRun.left(TaskRun.Position(task.toInt(), step.toInt()), handover)
            assertEquals("$task.$step with $handoverTask", row.subList(4, 6), listOf("${saved.task}", "${saved.step}"))
        }
    }

    @Test
    fun aTaskWithNoStepsOptionRunsOneStep() {
        val tap = WakeTasks.normalize(WakeTasks.decode("id=tap")).single()
        assertEquals(1, TaskRun.stepsOf(tap))
    }

    private fun shown(start: TaskRun.Start): List<String> = when (start) {
        is TaskRun.Start.One -> start.steps?.let { listOf(START_TITLE, DETAIL_STEPS, "$it") }
            ?: listOf(START_TITLE, DETAIL_NAME, FIXTURE_NONE)
        is TaskRun.Start.Pair -> listOf(START_TITLE, DETAIL_PAIR, FIXTURE_NONE)
        is TaskRun.Start.Count -> listOf(COUNT_TITLE, FIXTURE_NONE, "${start.size}")
    }

    @Test
    fun everyStartMatchesJs() {
        val rows = sharedTable("task-start.tsv")
        check(rows.isNotEmpty())
        for (row in rows) {
            val tasks = WakeTasks.normalize(WakeTasks.decode(row[0]))
            assertEquals(row[0], row.subList(1, 4), shown(TaskRun.start(tasks)))
        }
    }

    @Test
    fun aLoneTaskAndAPairNameTheirTasksInOrder() {
        val math = WakeTasks.normalize(WakeTasks.decode("id=math,difficulty=hard,steps=3;id=tap"))
        assertEquals(TaskRun.Start.One(math[0], 3), TaskRun.start(math.take(1)))
        assertEquals(TaskRun.Start.Pair(math[0], math[1]), TaskRun.start(math))
    }

    // The words task-start.tsv uses; START_ROW in wakeTasksNative.test.ts matches.
    private companion object {
        const val START_TITLE = "start"
        const val COUNT_TITLE = "count"
        const val DETAIL_NAME = "name"
        const val DETAIL_STEPS = "steps"
        const val DETAIL_PAIR = "pair"
    }
}
