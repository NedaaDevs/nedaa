package expo.modules.alarm

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.os.Build
import android.provider.Settings
import android.text.Editable
import android.text.TextPaint
import android.text.TextWatcher
import android.util.TypedValue
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.util.Locale

// The smallest touch target, as Android's accessibility guidance sets it.
internal const val MIN_TARGET_DP = 48

internal fun Context.dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

// Animations off in system settings, which JS reads as Reduce Motion.
internal fun animationsOff(context: Context): Boolean =
    Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f

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

// A number in the digits the shell's clock and counts use.
internal fun localeNumber(value: Int): String = String.format(Locale.getDefault(), "%d", value)

// Card shapes, as JS AnswerCard; a wrong card's edge is dashed.
internal object AnswerCardShape {
    const val RADIUS_DP = 16f
    const val EDGE_DP = 1.5f
    const val WRONG_EDGE_DP = 2f
    const val DASH_DP = 6f
    const val MARK_DP = 28
    const val MARK_INSET_DP = 8
    const val MARK_EDGE_DP = 2f
}

internal fun Context.dpf(value: Float): Float = value * resources.displayMetrics.density

private fun cardFill(context: Context, fill: String, edge: String, edgeDp: Float, dashed: Boolean) =
    GradientDrawable().apply {
        setColor(Color.parseColor(fill))
        cornerRadius = context.dpf(AnswerCardShape.RADIUS_DP)
        val dash = if (dashed) context.dpf(AnswerCardShape.DASH_DP) else 0f
        setStroke(context.dpf(edgeDp).toInt().coerceAtLeast(1), Color.parseColor(edge), dash, dash)
    }

// Only a card at rest shows a press: the pressed fill and a full edge.
internal fun answerCardBackground(context: Context, state: AnswerCardState): Drawable = when (state) {
    AnswerCardState.WRONG ->
        cardFill(context, COLOR_SURFACE, COLOR_ERROR, AnswerCardShape.WRONG_EDGE_DP, dashed = true)
    AnswerCardState.HELD -> cardFill(context, COLOR_SURFACE, COLOR_HAIRLINE, AnswerCardShape.EDGE_DP, false)
    AnswerCardState.REST -> StateListDrawable().apply {
        val pressed = cardFill(context, COLOR_PRESSED, COLOR_TEXT, AnswerCardShape.EDGE_DP, false)
        addState(intArrayOf(android.R.attr.state_pressed), pressed)
        addState(intArrayOf(), cardFill(context, COLOR_SURFACE, COLOR_HAIRLINE, AnswerCardShape.EDGE_DP, false))
    }
}

// The wrong card's corner badge: a ring with a cross, drawn only.
internal class WrongMark(private val edge: Float) : Drawable() {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = edge
        strokeCap = Paint.Cap.ROUND
        color = Color.parseColor(COLOR_ERROR)
    }

    override fun draw(canvas: Canvas) {
        val box = bounds
        val radius = (minOf(box.width(), box.height()) - edge) / 2f
        canvas.drawCircle(box.exactCenterX(), box.exactCenterY(), radius, paint)
        val arm = radius * CROSS_ARM
        val x = box.exactCenterX()
        val y = box.exactCenterY()
        canvas.drawLine(x - arm, y - arm, x + arm, y + arm, paint)
        canvas.drawLine(x - arm, y + arm, x + arm, y - arm, paint)
    }

    override fun setAlpha(alpha: Int) {
        paint.alpha = alpha
    }

    override fun setColorFilter(colorFilter: ColorFilter?) {
        paint.colorFilter = colorFilter
    }

    @Deprecated("Deprecated in Java")
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT

    private companion object {
        // Half the cross's span as a share of the ring's radius.
        const val CROSS_ARM = 0.4f
    }
}

// TalkBack names a view a button only from its class name.
internal fun View.speaksAsButton() {
    accessibilityDelegate = object : View.AccessibilityDelegate() {
        override fun onInitializeAccessibilityNodeInfo(host: View, info: AccessibilityNodeInfo) {
            super.onInitializeAccessibilityNodeInfo(host, info)
            info.className = Button::class.java.name
        }
    }
}

// Shrinks one line of text to fit its box: auto-size from API 26, else
// TextFit after each layout and text change.
internal fun fitOneLine(view: TextView, maxSp: Float, minSp: Float) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        view.setAutoSizeTextTypeUniformWithConfiguration(minSp.toInt(), maxSp.toInt(), 1, TypedValue.COMPLEX_UNIT_SP)
        return
    }
    view.setTextSize(TypedValue.COMPLEX_UNIT_SP, maxSp)
    val fit = Runnable { shrinkToWidth(view, maxSp, minSp) }
    view.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> view.post(fit) }
    view.addTextChangedListener(object : TextWatcher {
        override fun beforeTextChanged(text: CharSequence?, start: Int, count: Int, after: Int) = Unit
        override fun onTextChanged(text: CharSequence?, start: Int, before: Int, count: Int) = Unit
        override fun afterTextChanged(text: Editable?) {
            view.post(fit)
        }
    })
}

private fun shrinkToWidth(view: TextView, maxSp: Float, minSp: Float) {
    val room = view.width - view.totalPaddingLeft - view.totalPaddingRight
    if (room <= 0) return
    val roomHeight = view.height - view.totalPaddingTop - view.totalPaddingBottom
    val text = view.text.toString()
    val paint = TextPaint(view.paint)
    val metrics = view.resources.displayMetrics
    val sp = TextFit.sp(maxSp, minSp) { size ->
        paint.textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, size, metrics)
        val line = paint.fontMetrics.let { it.descent - it.ascent }
        TextFit.fitsBox(paint.measureText(text), line, room, roomHeight)
    }
    val px = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sp, metrics)
    if (view.textSize != px) view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
}
