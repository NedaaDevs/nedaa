package expo.modules.alarm

// A card at rest, held, marked wrong, or placed; ids as JS ANSWER_CARD_STATE.
enum class AnswerCardState(val id: String) {
    REST("rest"),
    HELD("held"),
    WRONG("wrong"),
    PLACED("placed"),
}

// The line under the sum, as JS MATH_LINE.
enum class MathLine(val id: String) {
    NONE("none"),
    WRONG("wrong"),
    NEW("new"),
}

// `asked` counts replaced questions; `wrong` is the card held as wrong.
data class MathBoardState(val round: MathRound, val asked: Int, val wrong: Int?, val solved: Boolean) {
    fun cardState(position: Int): AnswerCardState = when (wrong) {
        null -> AnswerCardState.REST
        position -> AnswerCardState.WRONG
        else -> AnswerCardState.HELD
    }

    val line: MathLine
        get() = when {
            wrong != null -> MathLine.WRONG
            asked > 0 -> MathLine.NEW
            else -> MathLine.NONE
        }
}

sealed interface MathTap {
    val state: MathBoardState? get() = null

    data class Solved(override val state: MathBoardState) : MathTap
    data class Wrong(override val state: MathBoardState) : MathTap
    data object Ignored : MathTap
}

// The math cards board's taps and replaced questions, as src/utils/mathBoard.ts
// plays them. math-board.tsv pins the two.
object MathBoardRun {

    // JS WRONG_CARD_HOLD_MS.
    const val WRONG_HOLD_MS = 600L

    fun start(difficulty: ChallengeDifficulty, rng: TaskRng.Rng): MathBoardState =
        MathBoardState(MathCards.round(difficulty, rng), asked = 0, wrong = null, solved = false)

    // Only a card at rest on an unsolved board takes a tap.
    fun tap(state: MathBoardState, position: Int): MathTap {
        if (state.solved || state.wrong != null) return MathTap.Ignored
        if (state.round.cards[position] == state.round.answer) return MathTap.Solved(state.copy(solved = true))
        return MathTap.Wrong(state.copy(wrong = position))
    }

    // Ends a wrong card's hold with a question of another answer.
    fun replace(state: MathBoardState, difficulty: ChallengeDifficulty, rng: TaskRng.Rng): MathBoardState {
        if (state.wrong == null) return state
        return MathBoardState(MathCards.round(difficulty, rng, state.round.question), state.asked + 1, null, false)
    }
}
