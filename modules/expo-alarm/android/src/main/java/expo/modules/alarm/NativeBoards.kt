package expo.modules.alarm

// Which native view runs each task, and which alarms run the task shell.
object NativeBoards {

    enum class Kind { TAP, MATH_CARDS, PRAYERS, PATTERN }

    // Dhikr has no native view yet and runs tap, so no task traps the alarm.
    fun kindOf(task: WakeTasks.Task): Kind = when (task.board) {
        WakeTasks.Board.MATH -> Kind.MATH_CARDS
        WakeTasks.Board.PRAYERS -> Kind.PRAYERS
        WakeTasks.Board.PATTERN -> Kind.PATTERN
        WakeTasks.Board.TAP, WakeTasks.Board.DHIKR -> Kind.TAP
    }

    // The board a task's name is shown as: the one that runs.
    fun shownBoard(task: WakeTasks.Task): WakeTasks.Board = when (kindOf(task)) {
        Kind.MATH_CARDS -> WakeTasks.Board.MATH
        Kind.PRAYERS -> WakeTasks.Board.PRAYERS
        Kind.PATTERN -> WakeTasks.Board.PATTERN
        Kind.TAP -> WakeTasks.Board.TAP
    }

    // As JS saysOpening: the board's status speaks the shell's step line.
    fun saysOpening(kind: Kind): Boolean = kind == Kind.PATTERN

    // As JS, any stack runs the shell, but a lone task with no board of its
    // own keeps its single challenge: Dhikr's typed phrase, not tap.
    fun runsShell(tasks: List<WakeTasks.Task>): Boolean {
        val lone = tasks.singleOrNull() ?: return tasks.isNotEmpty()
        return shownBoard(lone) == lone.board
    }
}
