package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

// task-run.tsv: what solving the board at each position of a stack leads to.
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
    fun aTaskWithNoStepsOptionRunsOneStep() {
        val tap = WakeTasks.normalize(WakeTasks.decode("id=tap")).single()
        assertEquals(1, TaskRun.stepsOf(tap))
    }
}
