package expo.modules.alarm

// Which native view runs each task, and which alarms run the task shell.
// `dhikrReviewed` is JS taskBoards' argument; an alarm reads DhikrTask.REVIEWED.
object NativeBoards {

    enum class Kind { TAP, MATH_CARDS, PRAYERS, PATTERN, DHIKR }

    // Dhikr under review runs tap, so no task traps the alarm.
    fun kindOf(task: WakeTasks.Task, dhikrReviewed: Boolean = DhikrTask.REVIEWED): Kind = when (task.board) {
        WakeTasks.Board.MATH -> Kind.MATH_CARDS
        WakeTasks.Board.PRAYERS -> Kind.PRAYERS
        WakeTasks.Board.PATTERN -> Kind.PATTERN
        WakeTasks.Board.DHIKR -> if (dhikrReviewed) Kind.DHIKR else Kind.TAP
        WakeTasks.Board.TAP -> Kind.TAP
    }

    // The board a task's name is shown as: the one that runs.
    fun shownBoard(task: WakeTasks.Task, dhikrReviewed: Boolean = DhikrTask.REVIEWED): WakeTasks.Board =
        when (kindOf(task, dhikrReviewed)) {
            Kind.MATH_CARDS -> WakeTasks.Board.MATH
            Kind.PRAYERS -> WakeTasks.Board.PRAYERS
            Kind.PATTERN -> WakeTasks.Board.PATTERN
            Kind.DHIKR -> WakeTasks.Board.DHIKR
            Kind.TAP -> WakeTasks.Board.TAP
        }

    // As JS saysOpening: the board's status speaks the shell's step line.
    fun saysOpening(kind: Kind): Boolean = kind == Kind.PATTERN

    // As JS, any stack runs the shell, but a lone task with no board of its
    // own keeps its single challenge: Dhikr's typed phrase, not tap.
    fun runsShell(tasks: List<WakeTasks.Task>, dhikrReviewed: Boolean = DhikrTask.REVIEWED): Boolean {
        val lone = tasks.singleOrNull() ?: return tasks.isNotEmpty()
        return shownBoard(lone, dhikrReviewed) == lone.board
    }
}
