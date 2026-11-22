package expo.modules.alarm

import android.content.Context
import android.view.View

// What a board gets to draw one step of its task.
data class BoardInput(
    val task: WakeTasks.Task,
    // What onDraw kept for this task's earlier steps; no native board reads it yet.
    val drawn: List<Int>,
    val rng: TaskRng.Rng,
)

// How a board reports to the shell.
interface BoardHost {
    // The step is solved; the shell takes the board away.
    fun onSolved()

    // The shell keeps the item and passes it to the task's later steps as BoardInput.drawn.
    fun onDraw(item: Int)
}

interface TaskBoard {
    val view: View

    // Called as the shell removes the board; frees its timers.
    fun release() {}
}

fun interface TaskBoardFactory {
    fun create(context: Context, input: BoardInput, host: BoardHost): TaskBoard
}

// Each native board's view and heading, and each task's name.
object TaskBoards {

    fun factoryOf(kind: NativeBoards.Kind): TaskBoardFactory = when (kind) {
        NativeBoards.Kind.TAP -> TaskBoardFactory { context, _, host -> TapBoard(context, host) }
        NativeBoards.Kind.MATH_CARDS -> TaskBoardFactory(::MathCardsBoard)
    }

    fun headingOf(kind: NativeBoards.Kind): Int = when (kind) {
        NativeBoards.Kind.TAP -> R.string.overlay_task_name_tap
        NativeBoards.Kind.MATH_CARDS -> R.string.overlay_task_title_math
    }

    // The task's own name, as the start button and the handover say it.
    fun nameOf(board: WakeTasks.Board): Int = when (board) {
        WakeTasks.Board.MATH -> R.string.overlay_task_name_math
        WakeTasks.Board.PATTERN -> R.string.overlay_task_name_pattern
        WakeTasks.Board.DHIKR -> R.string.overlay_task_name_dhikr
        WakeTasks.Board.PRAYERS -> R.string.overlay_task_name_prayers
        WakeTasks.Board.TAP -> R.string.overlay_task_name_tap
    }
}
