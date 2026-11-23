package expo.modules.alarm

// Where a stack's run stands, what a solved board leads to and what the start
// button says; the rules of src/utils/taskRun.ts. task-run.tsv and
// task-start.tsv pin both sides.
object TaskRun {

    // The task's index and the step within it, from 0.
    data class Position(val task: Int, val step: Int)

    val FIRST = Position(0, 0)

    // Ids as TASK_RUN_NEXT writes them.
    enum class Next(val id: String) { STEP("step"), HANDOVER("handover"), DONE("done") }

    sealed interface Advance {
        val next: Next

        data class Step(val position: Position) : Advance {
            override val next get() = Next.STEP
        }

        data class Handover(val position: Position) : Advance {
            override val next get() = Next.HANDOVER
        }

        object Done : Advance {
            override val next get() = Next.DONE
        }
    }

    fun stepsOf(task: WakeTasks.Task): Int = task.steps ?: WakeTasks.DEFAULT_STEPS

    fun difficultyOf(task: WakeTasks.Task): String = task.difficulty ?: WakeTasks.DEFAULT_DIFFICULTY

    // What solving the board at `position` leads to.
    fun advance(tasks: List<WakeTasks.Task>, position: Position): Advance {
        val task = tasks.getOrNull(position.task)
        if (task != null && position.step + 1 < stepsOf(task)) {
            return Advance.Step(position.copy(step = position.step + 1))
        }
        if (position.task + 1 < tasks.size) return Advance.Handover(Position(position.task + 1, 0))
        return Advance.Done
    }

    // What the start button says, as JS describeStart.
    sealed interface Start {
        // A title alone: the count carries the noun.
        data class Count(val size: Int) : Start

        data class Pair(val first: WakeTasks.Task, val second: WakeTasks.Task) : Start

        // The task's name; steps only when there are more than one.
        data class One(val task: WakeTasks.Task, val steps: Int?) : Start
    }

    fun start(tasks: List<WakeTasks.Task>): Start {
        require(tasks.isNotEmpty()) { "a start needs a task" }
        return when (tasks.size) {
            1 -> Start.One(tasks[0], stepsOf(tasks[0]).takeIf { it > 1 })
            2 -> Start.Pair(tasks[0], tasks[1])
            else -> Start.Count(tasks.size)
        }
    }
}
