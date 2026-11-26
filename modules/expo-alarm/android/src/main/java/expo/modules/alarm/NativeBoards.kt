package expo.modules.alarm

// Which native view runs each task, and which alarms run the task shell.
// `dhikrReviewed` is JS taskBoards' argument; an alarm reads DhikrTask.REVIEWED.
object NativeBoards {

    enum class Kind { TAP, MATH_CARDS, PRAYERS, PATTERN, DHIKR, DHIKR_TYPED }

    // As JS taskBoards: Dhikr under review types its phrase.
    fun kindOf(task: WakeTasks.Task, dhikrReviewed: Boolean = DhikrTask.REVIEWED): Kind = when (task.board) {
        WakeTasks.Board.MATH -> Kind.MATH_CARDS
        WakeTasks.Board.PRAYERS -> Kind.PRAYERS
        WakeTasks.Board.PATTERN -> Kind.PATTERN
        WakeTasks.Board.DHIKR -> if (dhikrReviewed) Kind.DHIKR else Kind.DHIKR_TYPED
        WakeTasks.Board.TAP -> Kind.TAP
    }

    // As JS saysOpening: the board's status speaks the shell's step line.
    fun saysOpening(kind: Kind): Boolean = kind == Kind.PATTERN

    // The shell window takes the keyboard only while this board shows.
    fun takesTyping(kind: Kind): Boolean = kind == Kind.DHIKR_TYPED

    // As JS, any stack runs the shell; an alarm with no task has only its dismiss.
    fun runsShell(tasks: List<WakeTasks.Task>): Boolean = tasks.isNotEmpty()
}
