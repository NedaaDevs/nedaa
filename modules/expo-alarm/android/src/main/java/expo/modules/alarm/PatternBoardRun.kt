package expo.modules.alarm

// As JS PATTERN_PHASE: playing, being repeated, a wrong pad held, solved.
enum class PatternPhase { WATCHING, REPEATING, WRONG, SOLVED }

// As JS PATTERN_PAD_STATE: a held pad takes no tap.
enum class PatternPadState { REST, LIT, WRONG, HELD }

// The line beside the dots, as JS PatternBoard's line().
sealed interface PatternLine {
    data class Showing(val at: Int, val total: Int, val new: Boolean) : PatternLine
    data class Turn(val done: Int, val total: Int) : PatternLine
    data object Wrong : PatternLine
    data object Done : PatternLine
}

// What the status node says; the first order also says the shell's opening.
sealed interface PatternStatus {
    data object Wrong : PatternStatus
    data object AfterMiss : PatternStatus
    data class Watch(val first: Boolean) : PatternStatus
}

// `step` is where the playing order stands; `plays` counts orders played;
// `wrong` is the pad held as wrong; `missed` holds until the next right tap.
data class PatternBoardState(
    val board: PatternState,
    val step: Int,
    val plays: Int,
    val wrong: PatternPad?,
    val missed: Boolean,
    val solved: Boolean,
) {
    val total: Int get() = board.pattern.size

    val frame: PlaybackFrame get() = PatternOrder.playbackFrame(step, total)

    val phase: PatternPhase
        get() = when {
            solved -> PatternPhase.SOLVED
            wrong != null -> PatternPhase.WRONG
            frame.playing -> PatternPhase.WATCHING
            else -> PatternPhase.REPEATING
        }

    fun padState(pad: PatternPad): PatternPadState = when (phase) {
        PatternPhase.WATCHING ->
            if (frame.lit?.let { board.pattern[it] } == pad) PatternPadState.LIT else PatternPadState.HELD
        PatternPhase.REPEATING -> PatternPadState.REST
        PatternPhase.WRONG -> if (pad == wrong) PatternPadState.WRONG else PatternPadState.HELD
        PatternPhase.SOLVED -> PatternPadState.HELD
    }

    val line: PatternLine
        get() = when (phase) {
            PatternPhase.WATCHING -> PatternLine.Showing(maxOf(1, frame.shown), total, missed)
            PatternPhase.REPEATING -> PatternLine.Turn(board.done, total)
            PatternPhase.WRONG -> PatternLine.Wrong
            PatternPhase.SOLVED -> PatternLine.Done
        }

    // Dots filled: pads lit so far while watching, else pads tapped.
    val filled: Int get() = if (phase == PatternPhase.WATCHING) frame.shown else board.done

    val status: PatternStatus
        get() = when {
            phase == PatternPhase.WRONG -> PatternStatus.Wrong
            missed -> PatternStatus.AfterMiss
            else -> PatternStatus.Watch(first = plays == 0)
        }

    // A held wrong pad offers no replay, so the old order is never heard again.
    val replayable: Boolean get() = phase == PatternPhase.WATCHING || phase == PatternPhase.REPEATING
}

sealed interface PatternBoardTap {
    data class Next(val state: PatternBoardState) : PatternBoardTap
    data class Done(val state: PatternBoardState) : PatternBoardTap
    data class Wrong(val state: PatternBoardState) : PatternBoardTap
    data object Ignored : PatternBoardTap
}

// The pattern board's turn, hold and replay, as JS PatternBoard runs them;
// every order and tap rule is PatternOrder's.
object PatternBoardRun {

    // JS PATTERN_TIMING.WRONG_HOLD and FADE.
    const val WRONG_HOLD_MS = 1000L
    const val FADE_MS = 160L

    fun start(difficulty: ChallengeDifficulty, rng: TaskRng.Rng): PatternBoardState = PatternBoardState(
        PatternState(PatternOrder.draw(difficulty, rng), 0),
        step = 0,
        plays = 0,
        wrong = null,
        missed = false,
        solved = false,
    )

    // The next playback step; an order already played stays put.
    fun advance(state: PatternBoardState): PatternBoardState =
        if (state.phase == PatternPhase.WATCHING) state.copy(step = state.step + 1) else state

    // Only a pad on an open turn takes a tap.
    fun tap(state: PatternBoardState, pad: PatternPad): PatternBoardTap {
        if (state.phase != PatternPhase.REPEATING) return PatternBoardTap.Ignored
        return when (val tap = PatternOrder.tap(state.board, pad)) {
            PatternTap.Wrong -> PatternBoardTap.Wrong(state.copy(wrong = pad))
            is PatternTap.Next -> PatternBoardTap.Next(state.copy(board = tap.state, missed = false))
            is PatternTap.Done -> PatternBoardTap.Done(state.copy(board = tap.state, solved = true))
        }
    }

    // Ends a wrong pad's hold: a new order, never the old one, plays.
    fun endHold(state: PatternBoardState, difficulty: ChallengeDifficulty, rng: TaskRng.Rng): PatternBoardState {
        if (state.wrong == null) return state
        return state.copy(
            board = PatternState(PatternOrder.draw(difficulty, rng, state.board.pattern), 0),
            step = 0,
            plays = state.plays + 1,
            wrong = null,
            missed = true,
        )
    }

    // A reader turned on or off: a playing order starts over on its timing.
    fun readerChanged(state: PatternBoardState): PatternBoardState =
        if (state.phase == PatternPhase.WATCHING) state.copy(step = 0) else state
}
