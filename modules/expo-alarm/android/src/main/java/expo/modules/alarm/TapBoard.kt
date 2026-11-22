package expo.modules.alarm

import android.content.Context
import android.graphics.Typeface
import android.os.SystemClock
import android.view.View
import android.widget.LinearLayout

// Tap's board: TAP_PRESSES presses on one button solve the step.
class TapBoard(context: Context, private val host: BoardHost) : TaskBoard {

    private var presses = 0

    private var lastCounted: Long? = null

    private val count = overlayText(context, 56f, COLOR_TEXT).apply {
        typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
        accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        setPadding(0, 0, 0, context.dp(24))
    }

    override val view: View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = matchWidth()
        addView(overlayText(context, 15f, COLOR_TEXT_MUTED).apply {
            text = context.resources.getQuantityString(R.plurals.overlay_task_tap_ask, TAP_PRESSES, TAP_PRESSES)
            setPadding(0, 0, 0, context.dp(16))
        })
        addView(count)
        val target = context.getString(R.string.overlay_task_tap_here)
        addView(overlayButton(context, target, COLOR_SUCCESS, COLOR_TEXT_ON_ACCENT).apply {
            minHeight = context.dp(TARGET_DP)
            minimumHeight = context.dp(TARGET_DP)
            setOnClickListener { press(it) }
        })
    }

    init {
        showCount(context)
    }

    private fun press(target: View) {
        val now = SystemClock.elapsedRealtime()
        if (presses >= TAP_PRESSES || !TapPress.counts(lastCounted, now)) return
        lastCounted = now
        presses++
        showCount(view.context)
        if (presses < TAP_PRESSES) {
            target.performHapticFeedback(OverlayHaptic.PRESS)
            return
        }
        target.performHapticFeedback(OverlayHaptic.CONFIRM)
        host.onSolved()
    }

    private fun showCount(context: Context) {
        count.text = context.getString(R.string.overlay_task_tap_count, presses, TAP_PRESSES)
    }

    companion object {
        // JS TAP_PRESSES.
        const val TAP_PRESSES = 10

        // As the JS target's $24 height.
        private const val TARGET_DP = 96
    }
}
