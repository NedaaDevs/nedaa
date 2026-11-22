package expo.modules.alarm

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.StateListAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.os.SystemClock
import android.view.View
import android.widget.Button
import android.widget.LinearLayout

// Tap's board, as JS TapBoard: TapPress.PRESSES counted presses on one
// target solve the step. It draws what TapPress decides.
class TapBoard(context: Context, private val host: BoardHost) : TaskBoard {

    private var state = TapBoardState()

    private val ask = overlayText(context, ASK_SP, COLOR_TEXT_MUTED).apply {
        typeface = Typeface.create(MEDIUM, Typeface.NORMAL)
        text = context.resources.getQuantityString(R.plurals.overlay_task_tap_ask, TapPress.PRESSES, TapPress.PRESSES)
    }

    // Tabular digits, so the count keeps its width as it rises.
    private val count = overlayText(context, COUNT_SP, COLOR_TEXT).apply {
        typeface = Typeface.create(MEDIUM, Typeface.NORMAL)
        fontFeatureSettings = TABULAR_DIGITS
        maxLines = 1
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, context.dp(COUNT_LINE_DP))
            .apply { topMargin = context.dp(STACK_DP) }
        fitOneLine(this, COUNT_SP, COUNT_MIN_SP)
    }

    private val ticks = TapTicks(context).apply {
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, context.dp(TICK_HEIGHT_DP))
            .apply { topMargin = context.dp(COUNT_GAP_DP) }
    }

    // Says each count but the last; the target's own label stays "Tap here".
    private val status = spokenStatus(context)

    private val target = Button(context).apply {
        text = context.getString(R.string.overlay_task_tap_here)
        isAllCaps = false
        maxLines = 1
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        setTextColor(Color.parseColor(COLOR_TEXT))
        background = targetBackground(context)
        stateListAnimator = if (animationsOff(context)) null else pressScale(this)
        setPadding(context.dp(TARGET_INSET_DP), 0, context.dp(TARGET_INSET_DP), 0)
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, context.dp(TARGET_DP))
            .apply { topMargin = context.dp(STACK_DP) }
        fitOneLine(this, TARGET_SP, TARGET_MIN_SP)
        setOnClickListener { press(it) }
    }

    override val view: View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = matchWidth()
        addView(ask)
        addView(count)
        addView(ticks)
        addView(target)
        addView(status)
    }

    init {
        show()
    }

    private fun press(target: View) {
        val tap = TapPress.press(state, SystemClock.elapsedRealtime())
        if (tap.outcome == TapOutcome.IGNORED) return
        state = tap.state
        show()
        if (tap.outcome == TapOutcome.COUNTED) {
            target.performHapticFeedback(OverlayHaptic.PRESS)
            return
        }
        target.performHapticFeedback(OverlayHaptic.CONFIRM)
        host.onSolved()
    }

    private fun show() {
        count.text = view.context.getString(R.string.overlay_task_tap_count, state.done, TapPress.PRESSES)
        ticks.done = state.done
        status.say(TapPress.statusOf(state.done)?.let(::localeNumber))
    }

    // As JS: the surface fill with a full edge, the pressed fill under a finger.
    private fun targetBackground(context: Context) = StateListDrawable().apply {
        addState(intArrayOf(android.R.attr.state_pressed), targetFill(context, COLOR_PRESSED))
        addState(intArrayOf(), targetFill(context, COLOR_SURFACE))
    }

    private fun targetFill(context: Context, fill: String) = GradientDrawable().apply {
        setColor(Color.parseColor(fill))
        cornerRadius = context.dpf(TARGET_RADIUS_DP)
        setStroke(context.dp(TARGET_EDGE_DP), Color.parseColor(COLOR_TEXT))
    }

    // As JS usePressScale; the release eases back with no spring.
    private fun pressScale(target: View) = StateListAnimator().apply {
        addState(intArrayOf(android.R.attr.state_pressed), scaleTo(target, PRESS_SCALE))
        addState(intArrayOf(), scaleTo(target, 1f))
    }

    private fun scaleTo(target: View, scale: Float) = AnimatorSet().apply {
        playTogether(
            ObjectAnimator.ofFloat(target, View.SCALE_X, scale),
            ObjectAnimator.ofFloat(target, View.SCALE_Y, scale),
        )
        duration = PRESS_DOWN_MS
    }

    companion object {
        // JS PRESS_SCALE and DURATION_MS.PRESS.
        const val PRESS_SCALE = 0.98f
        const val PRESS_DOWN_MS = 80L

        private const val MEDIUM = "sans-serif-medium"
        private const val TABULAR_DIGITS = "tnum"

        // JS sizes: the ask's lg, BOARD_TYPE.TAP_COUNT and TAP_TARGET, $stack,
        // $2, the target's $24, $hero radius and 2 edge.
        private const val ASK_SP = 16f
        private const val COUNT_SP = 56f
        private const val COUNT_LINE_DP = 73
        private const val TARGET_SP = 28f
        private const val STACK_DP = 12
        private const val COUNT_GAP_DP = 8
        private const val TARGET_DP = 96
        private const val TARGET_RADIUS_DP = 24f
        private const val TARGET_EDGE_DP = 2

        // How far the count and label shrink on a narrow, enlarged screen.
        private const val COUNT_MIN_SP = 24f
        private const val TARGET_MIN_SP = 16f

        // Keeps the label clear of the rounded edge.
        private const val TARGET_INSET_DP = 24

        private const val TICK_HEIGHT_DP = 8
    }
}

// One pill per press, filled from the start edge as presses count, as JS
// TapBoard's ticks. Pills narrow to fit; too narrow for the edge, none draw.
internal class TapTicks(context: Context) : View(context) {

    var done = 0
        set(value) {
            if (field == value) return
            field = value
            invalidate()
        }

    private val edge = context.dpf(TICK_EDGE_DP)

    private val outline = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = edge
        color = Color.parseColor(COLOR_TEXT)
    }

    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.parseColor(COLOR_TEXT)
    }

    private val pill = RectF()

    override fun onDraw(canvas: Canvas) {
        val gap = context.dpf(TICK_GAP_DP)
        val room = width - paddingLeft - paddingRight
        val shown = TickRow.layout(room.toFloat(), context.dpf(TICK_WIDTH_DP), gap, TapPress.PRESSES)
        if (!TickRow.drawable(shown, edge)) return
        val rtl = layoutDirection == LAYOUT_DIRECTION_RTL
        val half = edge / 2f
        val radius = height / 2f
        for (tick in 0 until TapPress.PRESSES) {
            val left = paddingLeft + TickRow.leftOf(tick, room.toFloat(), shown, gap, rtl)
            pill.set(left + half, half, left + shown.width - half, height - half)
            if (TickRow.filled(tick, done)) canvas.drawRoundRect(pill, radius, radius, fill)
            canvas.drawRoundRect(pill, radius, radius, outline)
        }
    }

    private companion object {
        // JS: each tick $6 wide, $1.5 apart, with a 1.5 edge.
        const val TICK_WIDTH_DP = 24f
        const val TICK_GAP_DP = 6f
        const val TICK_EDGE_DP = 1.5f
    }
}

// A centred row of equal pills: each as wide as allowed, narrowed to fit.
internal object TickRow {

    data class Shown(val start: Float, val width: Float)

    fun layout(room: Float, widest: Float, gap: Float, count: Int): Shown {
        val width = minOf(widest, (room - gap * (count - 1)) / count).coerceAtLeast(0f)
        val row = width * count + gap * (count - 1)
        return Shown(((room - row) / 2f).coerceAtLeast(0f), width)
    }

    // A pill narrower than its edge would draw inside out.
    fun drawable(shown: Shown, edge: Float): Boolean = shown.width > edge

    // A pill's left edge in the row; in RTL the first pill sits at the right.
    fun leftOf(tick: Int, room: Float, shown: Shown, gap: Float, rtl: Boolean): Float {
        val fromStart = shown.start + tick * (shown.width + gap)
        return if (rtl) room - fromStart - shown.width else fromStart
    }

    fun filled(tick: Int, done: Int): Boolean = tick < done
}
