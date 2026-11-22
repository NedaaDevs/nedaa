package expo.modules.alarm

// Which native view runs each task, and which alarms run the task shell.
object NativeBoards {

    // `typed` boards take a keyboard, so the overlay window must take focus.
    enum class Kind(val typed: Boolean) { TAP(false), TYPED_MATH(true) }

    // Pattern, prayers and dhikr have no native view yet and run tap,
    // so no task traps the alarm.
    fun kindOf(task: WakeTasks.Task): Kind = when (task.board) {
        WakeTasks.Board.MATH -> Kind.TYPED_MATH
        WakeTasks.Board.TAP, WakeTasks.Board.PATTERN, WakeTasks.Board.PRAYERS, WakeTasks.Board.DHIKR -> Kind.TAP
    }

    // The board a task's name is shown as: the one that runs.
    fun shownBoard(task: WakeTasks.Task): WakeTasks.Board = when (kindOf(task)) {
        Kind.TYPED_MATH -> WakeTasks.Board.MATH
        Kind.TAP -> WakeTasks.Board.TAP
    }

    // No stack or one task runs the single-challenge overlay unchanged.
    fun runsShell(tasks: List<WakeTasks.Task>): Boolean = tasks.size > 1

    fun needsKeyboard(tasks: List<WakeTasks.Task>): Boolean = tasks.any { kindOf(it).typed }
}
