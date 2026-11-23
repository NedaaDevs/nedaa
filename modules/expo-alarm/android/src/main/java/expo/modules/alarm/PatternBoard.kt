package expo.modules.alarm

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.View
import android.view.accessibility.AccessibilityManager
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.LinearLayout
import android.widget.TextView

// Repeat the pattern, as JS PatternBoard, drawing what PatternBoardRun
// decides: an order plays, then the turn; a miss holds, then a new order.
class PatternBoard(context: Context, private val input: BoardInput, private val host: BoardHost) : TaskBoard {

    private val difficulty =
        ChallengeDifficulty.fromId(TaskRun.difficultyOf(input.task)) ?: ChallengeDifficulty.EASY

    private val rng = input.rng

    private var state = PatternBoardRun.start(difficulty, rng)

    private val handler = Handler(Looper.getMainLooper())

    private val accessibility = context.getSystemService(AccessibilityManager::class.java)

    private var screenReader = accessibility?.isTouchExplorationEnabled == true

    private val fades = !animationsOff(context)

    // When the playing order's step 0 began, on the uptime clock.
    private var playedAt = 0L

    private val nextStep = Runnable { advance() }

    private val endHold = Runnable { replace() }

    private val focusStatus = Runnable {
        statusRow.performAccessibilityAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS, null)
    }

    private val readerListener = AccessibilityManager.TouchExplorationStateChangeListener { on -> readerChanged(on) }

    private val ask = overlayText(context, LINE_SP, COLOR_TEXT_MUTED)

    private val line = TextView(context).apply {
        textSize = LINE_SP
        typeface = Typeface.create(MEDIUM, Typeface.NORMAL)
        textAlignment = View.TEXT_ALIGNMENT_VIEW_START
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
    }

    private val dots = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { marginStart = context.dp(GAP_DP) }
        repeat(state.total) { index ->
            addView(View(context), LinearLayout.LayoutParams(context.dp(DOT_DP), context.dp(DOT_DP)).apply {
                if (index > 0) marginStart = context.dp(DOT_GAP_DP)
            })
        }
    }

    // One reader node: the order to repeat, and an action to hear it again.
    private val statusRow = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        minimumHeight = context.dp(STATUS_MIN_DP)
        isFocusable = true
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        layoutParams = matchWidth().apply { topMargin = context.dp(GAP_DP); bottomMargin = context.dp(GAP_DP) }
        accessibilityDelegate = hearAgainAction()
        addView(line)
        addView(dots)
    }

    private val pads = PatternPad.entries.map { pad -> PatternPadView(context, pad) { choose(it, pad) } }

    // Two by two, left to right in Arabic too: the places name each pad.
    private val grid = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutDirection = View.LAYOUT_DIRECTION_LTR
        layoutParams = matchWidth()
        pads.chunked(PATTERN_COLUMNS).forEachIndexed { row, pair ->
            addView(LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = matchWidth().apply { if (row > 0) topMargin = context.dp(GAP_DP) }
                pair.forEachIndexed { column, pad ->
                    addView(pad.frame, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                        if (column > 0) marginStart = context.dp(GAP_DP)
                    })
                }
            })
        }
    }

    // Says each right tap but the last; the shell speaks the solve.
    private val status = spokenStatus(context)

    override val view: View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = matchWidth()
        addView(ask)
        addView(statusRow)
        addView(grid)
        addView(status)
    }

    init {
        accessibility?.addTouchExplorationStateChangeListener(readerListener)
        show()
        play()
        focusIfReading()
    }

    override fun release() {
        accessibility?.removeTouchExplorationStateChangeListener(readerListener)
        handler.removeCallbacks(nextStep)
        handler.removeCallbacks(endHold)
        statusRow.removeCallbacks(focusStatus)
    }

    // Plays the current order from its start on the reader's timing.
    private fun play() {
        handler.removeCallbacks(nextStep)
        playedAt = SystemClock.uptimeMillis()
        scheduleNext()
    }

    private fun scheduleNext() {
        if (state.phase != PatternPhase.WATCHING) return
        val starts = PatternOrder.playbackStarts(state.total, PatternOrder.playbackTiming(!fades, screenReader))
        handler.postAtTime(nextStep, playedAt + starts[state.step + 1])
    }

    private fun advance() {
        state = PatternBoardRun.advance(state)
        show()
        scheduleNext()
    }

    private fun readerChanged(on: Boolean) {
        if (on == screenReader) return
        screenReader = on
        val playing = state.phase == PatternPhase.WATCHING
        state = PatternBoardRun.readerChanged(state)
        show()
        if (playing) play()
        focusIfReading()
    }

    // Each order takes reader focus, so the reader hears it before the turn.
    private fun focusIfReading() {
        if (!screenReader) return
        statusRow.removeCallbacks(focusStatus)
        statusRow.post(focusStatus)
    }

    private fun choose(pad: View, chosen: PatternPad) {
        when (val tap = PatternBoardRun.tap(state, chosen)) {
            PatternBoardTap.Ignored -> return
            is PatternBoardTap.Wrong -> {
                state = tap.state
                pad.performHapticFeedback(OverlayHaptic.REJECT)
                status.say(null)
                show()
                handler.postDelayed(endHold, PatternBoardRun.WRONG_HOLD_MS)
            }
            is PatternBoardTap.Next -> {
                state = tap.state
                pad.performHapticFeedback(OverlayHaptic.PRESS)
                show()
                status.say(view.context.getString(R.string.overlay_task_tap_count, state.board.done, state.total))
            }
            is PatternBoardTap.Done -> {
                state = tap.state
                pad.performHapticFeedback(OverlayHaptic.CONFIRM)
                show()
                host.onSolved()
            }
        }
    }

    private fun replace() {
        state = PatternBoardRun.endHold(state, difficulty, rng)
        show()
        play()
        focusIfReading()
    }

    private fun show() {
        val context = view.context
        val phase = state.phase
        ask.text = context.getString(
            if (phase == PatternPhase.WATCHING) R.string.overlay_task_pattern_watch_ask else R.string.overlay_task_pattern_turn_ask,
        )
        line.text = when (val shown = state.line) {
            is PatternLine.Showing -> context.getString(
                if (shown.new) R.string.overlay_task_pattern_showing_new else R.string.overlay_task_pattern_showing,
                shown.at,
                shown.total,
            )
            is PatternLine.Turn -> context.getString(R.string.overlay_task_pattern_turn, shown.done, shown.total)
            PatternLine.Wrong -> context.getString(R.string.overlay_task_pattern_wrong)
            PatternLine.Done -> context.getString(R.string.overlay_task_pattern_done)
        }
        line.setTextColor(Color.parseColor(if (phase == PatternPhase.WRONG) COLOR_TEXT else COLOR_TEXT_MUTED))
        dots.visibility = if (phase == PatternPhase.WRONG) View.GONE else View.VISIBLE
        for (index in 0 until dots.childCount) dots.getChildAt(index).background = dot(context, index < state.filled)
        statusRow.contentDescription = statusLabel()
        pads.forEachIndexed { index, pad ->
            val chosen = PatternPad.entries[index]
            val spoken = context.getString(R.string.overlay_task_card, nameOf(chosen), context.getString(placeOf(chosen)))
            pad.show(state.padState(chosen), spoken, fades)
        }
    }

    private fun statusLabel(): String {
        val context = view.context
        return when (val said = state.status) {
            PatternStatus.Wrong -> context.getString(R.string.overlay_task_pattern_wrong)
            PatternStatus.AfterMiss -> context.getString(R.string.overlay_task_pattern_after_miss, order())
            is PatternStatus.Watch -> {
                val watch = context.getString(R.string.overlay_task_pattern_watch, order())
                val opening = input.opening
                if (said.first && opening != null) context.getString(R.string.overlay_sentences, opening, watch) else watch
            }
        }
    }

    private fun order(): String =
        state.board.pattern.joinToString(view.context.getString(R.string.overlay_list_separator)) { nameOf(it) }

    private fun nameOf(pad: PatternPad): String = view.context.getString(padNameOf(pad))

    private fun dot(context: Context, filled: Boolean) = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        if (filled) setColor(Color.parseColor(COLOR_TEXT))
        setStroke(context.dpf(DOT_EDGE_DP).toInt().coerceAtLeast(1), Color.parseColor(COLOR_TEXT))
    }

    private fun hearAgainAction() = object : View.AccessibilityDelegate() {
        override fun onInitializeAccessibilityNodeInfo(host: View, info: AccessibilityNodeInfo) {
            super.onInitializeAccessibilityNodeInfo(host, info)
            if (!state.replayable) return
            val label = host.context.getString(R.string.overlay_task_pattern_hear_again)
            info.addAction(AccessibilityNodeInfo.AccessibilityAction(R.id.overlay_action_hear_again, label))
        }

        override fun performAccessibilityAction(host: View, action: Int, args: Bundle?): Boolean {
            if (action != R.id.overlay_action_hear_again) return super.performAccessibilityAction(host, action, args)
            if (!state.replayable) return false
            host.announceForAccessibility(host.context.getString(R.string.overlay_task_pattern_again, order()))
            return true
        }
    }

    private companion object {
        const val MEDIUM = "sans-serif-medium"

        // JS sizes: lg lines, the status row's $14, a dot's $3 and $2 gap, $stack.
        const val LINE_SP = 16f
        const val STATUS_MIN_DP = 56
        const val DOT_DP = 12
        const val DOT_GAP_DP = 8
        const val DOT_EDGE_DP = 1.5f
        const val GAP_DP = 12
    }
}

// The pads sit in rows of this many, in PatternPad's order.
internal const val PATTERN_COLUMNS = 2

// What a reader calls each pad's shape, as JS PATTERN_PAD_NAME_KEY.
internal fun padNameOf(pad: PatternPad): Int = when (pad) {
    PatternPad.CIRCLE -> R.string.overlay_task_pattern_pad_circle
    PatternPad.TRIANGLE -> R.string.overlay_task_pattern_pad_triangle
    PatternPad.SQUARE -> R.string.overlay_task_pattern_pad_square
    PatternPad.LINES -> R.string.overlay_task_pattern_pad_lines
}

// Where each pad sits, as JS PATTERN_PAD_PLACE_KEY.
internal fun placeOf(pad: PatternPad): Int = when (pad) {
    PatternPad.CIRCLE -> R.string.overlay_task_pattern_place_top_left
    PatternPad.TRIANGLE -> R.string.overlay_task_pattern_place_top_right
    PatternPad.SQUARE -> R.string.overlay_task_pattern_place_bottom_left
    PatternPad.LINES -> R.string.overlay_task_pattern_place_bottom_right
}
