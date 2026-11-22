package expo.modules.alarm

import android.content.Context
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.LinearLayout

// Math's board: a sum and four answer cards, as JS MathBoard. It draws what
// MathBoardRun decides; a wrong card holds, then a new sum replaces it.
class MathCardsBoard(context: Context, input: BoardInput, private val host: BoardHost) : TaskBoard {

    private val difficulty =
        ChallengeDifficulty.fromId(TaskRun.difficultyOf(input.task)) ?: ChallengeDifficulty.EASY

    private val rng = input.rng

    private var state = MathBoardRun.start(difficulty, rng)

    private val handler = Handler(Looper.getMainLooper())

    private val endHold = Runnable { replace() }

    private val focusSum = Runnable {
        sum.performAccessibilityAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS, null)
    }

    // A sum reads left to right in either layout direction.
    private val sum = overlayText(context, SUM_SP, COLOR_TEXT).apply {
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        textDirection = View.TEXT_DIRECTION_LTR
        maxLines = 1
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, context.dp(SUM_LINE_DP))
        fitOneLine(this, SUM_SP, SUM_MIN_SP)
    }

    private val line = overlayText(context, LINE_SP, COLOR_TEXT_MUTED).apply {
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        minHeight = context.dp(LINE_MIN_DP)
    }

    private val cards = List(MathCards.CARD_COUNT) { position ->
        AnswerCardView(context, CARD_SIZE) { choose(it, position) }
    }

    private val grid = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = matchWidth()
        cards.chunked(COLUMNS).forEachIndexed { row, pair ->
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = matchWidth().apply { if (row > 0) topMargin = context.dp(GAP_DP) }
                pair.forEachIndexed { column, card ->
                    addView(card.frame, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                        if (column > 0) marginStart = context.dp(GAP_DP)
                    })
                }
            })
        }
    }

    override val view: View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = matchWidth()
        addView(sum)
        addView(line, matchWidth().apply { topMargin = context.dp(GAP_DP); bottomMargin = context.dp(GAP_DP) })
        addView(grid)
    }

    init {
        show()
    }

    override fun release() {
        handler.removeCallbacks(endHold)
        handler.removeCallbacks(focusSum)
    }

    private fun choose(card: View, position: Int) {
        when (val tap = MathBoardRun.tap(state, position)) {
            MathTap.Ignored -> return
            is MathTap.Solved -> {
                state = tap.state
                card.performHapticFeedback(OverlayHaptic.CONFIRM)
                host.onSolved()
            }
            is MathTap.Wrong -> {
                state = tap.state
                card.performHapticFeedback(OverlayHaptic.REJECT)
                show()
                handler.postDelayed(endHold, MathBoardRun.WRONG_HOLD_MS)
            }
        }
    }

    private fun replace() {
        state = MathBoardRun.replace(state, difficulty, rng)
        show()
        for (part in listOf(sum, grid)) {
            part.alpha = 0f
            part.animate().alpha(1f).setDuration(SWAP_IN_MS).start()
        }
        handler.post(focusSum)
    }

    private fun show() {
        val context = view.context
        val question = state.round.question
        val sign = when (question.operation) {
            MathOperation.ADD -> PLUS
            MathOperation.MULTIPLY -> TIMES
        }
        val spokenKey = when (question.operation) {
            MathOperation.ADD -> R.string.overlay_task_math_add
            MathOperation.MULTIPLY -> R.string.overlay_task_math_multiply
        }
        val left = localeNumber(question.left)
        val right = localeNumber(question.right)
        sum.text = "$left $sign $right"
        val said = context.getString(spokenKey, left, right)
        sum.contentDescription =
            if (state.asked > 0) context.getString(R.string.overlay_task_math_after_miss, said) else said
        line.text = when (state.line) {
            MathLine.NONE -> ""
            MathLine.WRONG -> context.getString(R.string.overlay_task_math_wrong)
            MathLine.NEW -> context.getString(R.string.overlay_task_math_new)
        }
        cards.forEachIndexed { position, card -> showCard(card, position) }
    }

    private fun showCard(card: AnswerCardView, position: Int) {
        val context = card.frame.context
        val label = localeNumber(state.round.cards[position])
        val named = context.getString(R.string.overlay_task_card, label, context.getString(ANSWER_CARD_PLACE[position]))
        card.show(state.cardState(position), label, named)
    }

    companion object {
        // JS BOARD_SWAP_MS.IN.
        const val SWAP_IN_MS = 280L

        private const val PLUS = "+"
        private const val TIMES = "×"

        // JS BOARD_TYPE.SUM, CARD_NUMERAL, the line's lg and $12, a card's $24.
        private const val SUM_SP = 96f
        private const val SUM_LINE_DP = 110
        private const val CARD_SP = 44f
        private const val LINE_SP = 16f
        private const val LINE_MIN_DP = 48
        private const val CARD_MIN_DP = 96

        // How far a sum or card shrinks on a narrow, enlarged screen.
        private const val SUM_MIN_SP = 40f
        private const val CARD_MIN_SP = 20f

        // Holds the card numeral's line, so auto-size has a bounded box.
        private const val CARD_LABEL_DP = 64

        // Clear of the corner mark, so the centred number never moves.
        private const val CARD_INSET_DP = AnswerCardShape.MARK_INSET_DP + AnswerCardShape.MARK_DP

        private val CARD_SIZE = AnswerCardSize(CARD_SP, CARD_MIN_SP, CARD_LABEL_DP, CARD_MIN_DP, CARD_INSET_DP)

        // JS $stack, between the parts and between cards.
        private const val GAP_DP = 12
        private const val COLUMNS = 2
    }
}

// A card's place by position, as JS ANSWER_CARD_PLACE_KEY.
internal val ANSWER_CARD_PLACE = listOf(
    R.string.overlay_task_card_place_first,
    R.string.overlay_task_card_place_second,
    R.string.overlay_task_card_place_third,
    R.string.overlay_task_card_place_fourth,
)
