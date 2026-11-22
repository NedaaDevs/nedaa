package expo.modules.alarm

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

// The smallest touch target, as Android's accessibility guidance sets it.
internal const val MIN_TARGET_DP = 48

internal fun Context.dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

internal fun matchWidth(): LinearLayout.LayoutParams =
    LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)

internal fun overlayText(context: Context, sizeSp: Float, color: String): TextView = TextView(context).apply {
    textSize = sizeSp
    setTextColor(Color.parseColor(color))
    gravity = Gravity.CENTER
    layoutParams = matchWidth()
}

internal fun overlayButton(context: Context, label: String, fill: String, ink: String): Button = Button(context).apply {
    text = label
    textSize = 18f
    isAllCaps = false
    setTextColor(Color.parseColor(ink))
    background = GradientDrawable().apply {
        setColor(Color.parseColor(fill))
        cornerRadius = context.dp(16).toFloat()
    }
    minHeight = context.dp(MIN_TARGET_DP)
    minimumHeight = context.dp(MIN_TARGET_DP)
    setPadding(context.dp(24), context.dp(18), context.dp(24), context.dp(18))
    layoutParams = matchWidth()
}

// The haptics the JS boards give: a light press, a success and a reject.
internal object OverlayHaptic {
    const val PRESS = HapticFeedbackConstants.VIRTUAL_KEY

    val CONFIRM =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.LONG_PRESS

    val REJECT =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) HapticFeedbackConstants.REJECT else HapticFeedbackConstants.LONG_PRESS
}

// A one-pixel live region that speaks a status and shows nothing, as JS SpokenStatus.
internal fun spokenStatus(context: Context): TextView = TextView(context).apply {
    accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
    setTextColor(Color.TRANSPARENT)
    layoutParams = LinearLayout.LayoutParams(1, 1)
}

// Only a changed message is spoken; empty speaks nothing.
internal fun TextView.say(message: String?) {
    val next = message.orEmpty()
    if (text.toString() != next) text = next
}
