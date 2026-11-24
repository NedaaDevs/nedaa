package expo.modules.alarm

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ReplacementSpan
import android.util.TypedValue
import android.view.View
import android.view.accessibility.AccessibilityManager
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.LinearLayout
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.roundToInt

// A dhikr with one word missing and four cards, as JS DhikrBoard; no card is
// ever marked. DhikrBoardRun decides each tap.
class DhikrBoard(context: Context, input: BoardInput, private val host: BoardHost) : TaskBoard {

    private val rows = DhikrTask.ROWS

    private val rng = input.rng

    private var state = DhikrBoardRun.start(rows, input.drawn, rng)

    private val handler = Handler(Looper.getMainLooper())

    private val endHold = Runnable { replace() }

    private val focusLine = Runnable {
        line.performAccessibilityAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS, null)
    }

    private val accessibility = context.getSystemService(AccessibilityManager::class.java)

    private var fill: ValueAnimator? = null

    private val ask = overlayText(context, LINE_SP, COLOR_TEXT_MUTED).apply {
        text = context.getString(R.string.overlay_task_dhikr_ask)
    }

    // Kept while empty, so the panel and cards never move.
    private val note = overlayText(context, NOTE_SP, COLOR_TEXT_MUTED).apply {
        minHeight = context.dp(NOTE_MIN_DP)
    }

    // The dhikr as written, right to left in any app language; the gap is a span.
    private val line = overlayText(context, DHIKR_SP, COLOR_TEXT).apply {
        typeface = Typeface.create(MEDIUM, Typeface.NORMAL)
        textDirection = View.TEXT_DIRECTION_RTL
        isFocusable = true
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        val target = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, DHIKR_LINE_SP, resources.displayMetrics)
        setLineSpacing((target - paint.fontSpacing).coerceAtLeast(0f), 1f)
    }

    private val panel = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = matchWidth().apply { topMargin = context.dp(GAP_DP) }
        background = GradientDrawable().apply {
            setColor(Color.parseColor(COLOR_SURFACE))
            cornerRadius = context.dpf(PANEL_RADIUS_DP)
            setStroke(context.dpf(PANEL_EDGE_DP).toInt().coerceAtLeast(1), Color.parseColor(COLOR_HAIRLINE))
        }
        val inline = context.dp(PANEL_INLINE_DP)
        val block = context.dp(GAP_DP)
        setPadding(inline, block, inline, block)
        addView(note)
        addView(line, matchWidth().apply { topMargin = context.dp(LINE_GAP_DP) })
    }

    private val message = overlayText(context, LINE_SP, COLOR_TEXT_MUTED).apply {
        typeface = Typeface.create(MEDIUM, Typeface.NORMAL)
        minHeight = context.dp(MIN_TARGET_DP)
    }

    private val cards = ANSWER_CARD_PLACE.indices.map { position ->
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
        addView(ask)
        addView(panel)
        addView(message, matchWidth().apply { topMargin = context.dp(GAP_DP); bottomMargin = context.dp(GAP_DP) })
        addView(grid)
    }

    init {
        host.onDraw(state.round.row)
        show(fade = false)
    }

    override fun release() {
        handler.removeCallbacks(endHold)
        handler.removeCallbacks(focusLine)
        fill?.cancel()
    }

    private fun choose(card: View, position: Int) {
        when (val tap = DhikrBoardRun.choose(state, position, rows)) {
            DhikrTap.Ignored -> return
            is DhikrTap.Solved -> {
                state = tap.state
                card.performHapticFeedback(OverlayHaptic.CONFIRM)
                host.onSolved()
            }
            is DhikrTap.Held -> {
                state = tap.state
                card.performHapticFeedback(OverlayHaptic.PRESS)
                show(fade = true)
                val completed = completedSpoken()
                line.announceForAccessibility(completed)
                val reader = accessibility?.isTouchExplorationEnabled == true
                handler.postDelayed(endHold, DhikrBoardRun.holdMs(reader, completed.length.toLong()))
            }
        }
    }

    private fun replace() {
        state = DhikrBoardRun.replace(state, rows, rng)
        host.onDraw(state.round.row)
        show(fade = false)
        for (part in listOf(panel, grid)) fadeIn(part, MathCardsBoard.SWAP_IN_MS)
        handler.post(focusLine)
    }

    private fun show(fade: Boolean) {
        val context = view.context
        val row = rows[state.round.row]
        note.text = if (state.noteShown) context.getString(R.string.overlay_task_dhikr_completed) else ""
        note.importantForAccessibility =
            if (state.noteShown) View.IMPORTANT_FOR_ACCESSIBILITY_YES else View.IMPORTANT_FOR_ACCESSIBILITY_NO
        showLine(row, fade)
        message.text = if (state.anotherShown) context.getString(R.string.overlay_task_dhikr_another) else ""
        cards.forEachIndexed { position, card ->
            val word = state.round.cards[position]
            val place = context.getString(ANSWER_CARD_PLACE[position])
            card.show(state.cardState, word, context.getString(R.string.overlay_task_card, word, place))
        }
    }

    private fun showLine(row: DhikrTask.Row, fade: Boolean) {
        val context = line.context
        val gap = GapSpan(context, state.gapFilled) { line.width - line.paddingLeft - line.paddingRight }
        line.text = SpannableStringBuilder(row.before).apply {
            append(DhikrGap.textOf(row, state.gapFilled), gap, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            append(row.after)
        }
        val spoken = DhikrRules.spoken(row, context.getString(R.string.overlay_task_dhikr_gap))
        line.contentDescription = when (state.label) {
            DhikrLabel.FULL -> DhikrRules.full(row)
            DhikrLabel.ANOTHER -> context.getString(R.string.overlay_task_dhikr_another_spoken, spoken)
            DhikrLabel.SPOKEN -> spoken
        }
        fill?.cancel()
        if (!fade || !state.gapFilled || animationsOff(context)) return
        gap.wordAlpha = 0f
        fill = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = FILL_MS
            addUpdateListener {
                gap.wordAlpha = it.animatedValue as Float
                line.invalidate()
            }
            start()
        }
    }

    private fun completedSpoken(): String {
        val row = rows[state.round.row]
        return view.context.getString(R.string.overlay_task_dhikr_completed_spoken, row.answer, DhikrRules.full(row))
    }

    // The dhikr's gap: dashed while empty, solid round its word once filled.
    private class GapSpan(
        context: Context,
        private val filled: Boolean,
        // The line's width for text; 0 before its first layout.
        private val available: () -> Int,
    ) : ReplacementSpan() {

        var wordAlpha = 1f

        private val minWidth = context.dp(GAP_MIN_WIDTH_DP)
        private val minHeight = context.dpf(GAP_MIN_HEIGHT_DP)
        private val inline = context.dp(GAP_INLINE_DP)
        private val radius = context.dpf(GAP_RADIUS_DP)
        private val dash = context.dpf(AnswerCardShape.DASH_DP)
        private val edge = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = context.dpf(GAP_EDGE_DP)
            color = Color.parseColor(COLOR_PRIMARY)
            if (!filled) pathEffect = DashPathEffect(floatArrayOf(dash, dash), 0f)
        }

        override fun getSize(paint: Paint, text: CharSequence, start: Int, end: Int, fm: Paint.FontMetricsInt?): Int {
            fm?.let {
                paint.getFontMetricsInt(it)
                val box = boxOf(paint)
                it.ascent = minOf(it.ascent, floor(box.top).toInt())
                it.top = minOf(it.top, it.ascent)
                it.descent = maxOf(it.descent, ceil(box.bottom).toInt())
                it.bottom = maxOf(it.bottom, it.descent)
            }
            if (!filled) return minWidth
            return fitOf(paint, text, start, end).width.roundToInt()
        }

        private fun fitOf(paint: Paint, text: CharSequence, start: Int, end: Int): DhikrGap.Fit =
            DhikrGap.fitOf(paint.measureText(text, start, end), inline.toFloat(), minWidth.toFloat(), available().toFloat())

        override fun draw(
            canvas: Canvas,
            text: CharSequence,
            start: Int,
            end: Int,
            x: Float,
            top: Int,
            y: Int,
            bottom: Int,
            paint: Paint,
        ) {
            val width = getSize(paint, text, start, end, null)
            val span = boxOf(paint)
            val half = edge.strokeWidth / 2f
            val box = RectF(x + half, y + span.top + half, x + width - half, y + span.bottom - half)
            canvas.drawRoundRect(box, radius, radius, edge)
            if (!filled) return
            val ink = paint.alpha
            val size = paint.textSize
            val fit = fitOf(paint, text, start, end)
            paint.alpha = (ink * wordAlpha).roundToInt()
            paint.textSize = size * fit.scale
            val word = paint.measureText(text, start, end)
            canvas.drawText(text, start, end, x + (width - word) / 2f, y.toFloat(), paint)
            paint.textSize = size
            paint.alpha = ink
        }

        // The box from the baseline; getSize makes its line this tall.
        private fun boxOf(paint: Paint): DhikrGap.Box {
            val metrics = paint.fontMetrics
            return DhikrGap.boxOf(metrics.ascent, metrics.descent, minHeight)
        }
    }

    companion object {
        // JS DHIKR_FILL_MS.
        const val FILL_MS = 280L

        private const val MEDIUM = "sans-serif-medium"

        // JS sizes: lg lines, the note, BOARD_TYPE.DHIKR, the $hero panel and
        // a dhikr card's 88.
        private const val LINE_SP = 16f
        private const val NOTE_SP = 14f
        private const val NOTE_MIN_DP = 24
        private const val DHIKR_SP = 30f
        private const val DHIKR_LINE_SP = 63f
        private const val PANEL_RADIUS_DP = 24f
        private const val PANEL_EDGE_DP = 1.5f
        private const val PANEL_INLINE_DP = 16
        private const val LINE_GAP_DP = 8
        private const val CARD_SP = 26f
        private const val CARD_MIN_DP = 88

        // The gap's $24 by $12, $inline padding, $chip corner and 2 edge.
        private const val GAP_MIN_WIDTH_DP = 96
        private const val GAP_MIN_HEIGHT_DP = 48f
        private const val GAP_INLINE_DP = 8
        private const val GAP_RADIUS_DP = 8f
        private const val GAP_EDGE_DP = 2f

        // A card word's least size, and a box that clears its tashkeel.
        private const val CARD_MIN_SP = 12f
        private const val CARD_LABEL_DP = 52

        // JS AnswerCard's $stack.
        private const val CARD_INSET_DP = 12

        // JS $stack, between the parts and between cards.
        private const val GAP_DP = 12
        private const val COLUMNS = 2

        private val CARD_SIZE = AnswerCardSize(CARD_SP, CARD_MIN_SP, CARD_LABEL_DP, CARD_MIN_DP, CARD_INSET_DP)
    }
}
