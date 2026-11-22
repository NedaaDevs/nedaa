package expo.modules.alarm

// One stack's run through the shell, as TaskShell.tsx keeps it. Each restart
// takes the quiet length the caller reads then; the view applies each result.
class TaskShellRun(private val tasks: List<WakeTasks.Task>, private var quietMs: Long, openedAt: Long) {

    init {
        require(tasks.isNotEmpty()) { "a run needs a task" }
    }

    // A solved board's result and the sound change its new quiet time calls for.
    data class Solved(val advance: TaskRun.Advance, val signal: TaskQuiet.Signal?)

    var position: TaskRun.Position = TaskRun.FIRST
        private set

    // The task the handover leads to; no board takes a solve meanwhile.
    var handover: TaskRun.Position? = null
        private set

    // The last task is solved and the alarm has stopped.
    var done = false
        private set

    var reading = TaskQuiet.Reading(TaskClock.start(openedAt, quietMs), openedAt)
        private set

    private val draws = mutableMapOf<WakeTasks.Board, List<Int>>()

    val size: Int get() = tasks.size

    val task: WakeTasks.Task get() = tasks[position.task]

    fun taskAt(position: TaskRun.Position): WakeTasks.Task = tasks[position.task]

    val wayOut: Boolean get() = !done && reading.clock.wayOutShown

    // What the current task's earlier steps drew, oldest first.
    val drawn: List<Int> get() = draws[task.board].orEmpty()

    fun draw(item: Int) {
        draws[task.board] = drawn + item
    }

    fun open(): TaskQuiet.Signal? = quiet(TaskQuiet.Event.OPEN, reading.now)

    fun tick(now: Long): TaskQuiet.Signal? = quiet(TaskQuiet.Event.TICK, now)

    // Null while no board shows.
    fun solved(now: Long, quietMs: Long): Solved? {
        if (done || handover != null) return null
        val advance = TaskRun.advance(tasks, position)
        if (advance is TaskRun.Advance.Done) {
            done = true
            return Solved(advance, null)
        }
        val signal = restart(now, quietMs)
        when (advance) {
            is TaskRun.Advance.Handover -> handover = advance.position
            is TaskRun.Advance.Step -> position = advance.position
            TaskRun.Advance.Done -> Unit
        }
        return Solved(advance, signal)
    }

    // The next task's board shows with a full quiet time.
    fun finishHandover(now: Long, quietMs: Long): TaskQuiet.Signal? {
        position = handover ?: return null
        handover = null
        return restart(now, quietMs)
    }

    private fun restart(now: Long, quietMs: Long): TaskQuiet.Signal? {
        this.quietMs = quietMs
        return quiet(TaskQuiet.Event.RESTART, now)
    }

    private fun quiet(event: TaskQuiet.Event, now: Long): TaskQuiet.Signal? {
        val step = TaskQuiet.step(reading, event, now, quietMs, audible = !done)
        reading = step.reading
        return step.signal
    }

    // What the progress status says, as JS TaskShell's progressStatus for a
    // board that does not say its own opening.
    sealed interface Spoken {
        data class Handover(val next: TaskRun.Position) : Spoken
        data class Step(val position: TaskRun.Position) : Spoken
        data object Silent : Spoken
    }

    companion object {
        // How long the handover shows: JS HANDOVER_MS IN + HOLD; the native panel has no fade.
        const val HANDOVER_MS = 180L + 1000L

        // The handover first; else the step line from the second step until done.
        fun spokenProgress(handover: TaskRun.Position?, position: TaskRun.Position, done: Boolean): Spoken = when {
            handover != null -> Spoken.Handover(handover)
            position.step > 0 && !done -> Spoken.Step(position)
            else -> Spoken.Silent
        }
    }
}
