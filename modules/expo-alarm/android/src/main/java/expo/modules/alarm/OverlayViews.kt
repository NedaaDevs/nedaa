package expo.modules.alarm

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.StateListAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.Typeface
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
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import java.util.Locale

// The smallest touch target, as Android's accessibility guidance sets it.
internal const val MIN_TARGET_DP = 48

internal fun Context.dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

// The transition scale at zero, which RN reads as Reduce Motion.
internal fun animationsOff(context: Context): Boolean =
    Settings.Global.getString(context.contentResolver, Settings.Global.TRANSITION_ANIMATION_SCALE)
        ?.replace(',', '.')?.toFloatOrNull() == 0f

// As a JS entering fade: none with animations off.
internal fun fadeIn(part: View, ms: Long) {
    part.animate().cancel()
    if (animationsOff(part.context)) {
        part.alpha = 1f
        return
    }
    part.alpha = 0f
    part.animate().alpha(1f).setDuration(ms).start()
}

// JS PRESS_SCALE and DURATION_MS.PRESS.
internal const val PRESS_SCALE = 0.98f
internal const val PRESS_DOWN_MS = 80L

// As JS usePressScale: none with animations off, no spring on release.
internal fun pressScale(target: View): StateListAnimator? =
    if (animationsOff(target.context)) {
        null
    } else {
        StateListAnimator().apply {
            addState(intArrayOf(android.R.attr.state_pressed), scaleTo(target, PRESS_SCALE))
            addState(intArrayOf(), scaleTo(target, 1f))
        }
    }

private fun scaleTo(target: View, scale: Float) = AnimatorSet().apply {
    playTogether(
        ObjectAnimator.ofFloat(target, View.SCALE_X, scale),
        ObjectAnimator.ofFloat(target, View.SCALE_Y, scale),
    )
    duration = PRESS_DOWN_MS
}

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
    const val PLACED_EDGE_DP = 2.5f
    const val DASH_DP = 6f
    const val MARK_DP = 28
    const val MARK_INSET_DP = 8
    const val MARK_EDGE_DP = 2f

    // JS size label; a placed mark's numeral shrinks to stay in its ring.
    const val MARK_SP = 15f
    const val MARK_MIN_SP = 8f
}

internal fun Context.dpf(value: Float): Float = value * resources.displayMetrics.density

internal fun cardFill(context: Context, fill: String, edge: String, edgeDp: Float, dashed: Boolean) =
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
    AnswerCardState.PLACED ->
        cardFill(context, COLOR_SURFACE, COLOR_PRIMARY, AnswerCardShape.PLACED_EDGE_DP, dashed = false)
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

// An answer card's label size and edge inset, and the card's least height.
internal data class AnswerCardSize(
    val labelSp: Float,
    val minSp: Float,
    val labelDp: Int,
    val minDp: Int,
    val labelInsetDp: Int,
)

// One answer on a board's grid, as JS AnswerCard: only a card at rest takes
// a tap; a placed card is hidden from the reader, which hears the board instead.
internal class AnswerCardView(context: Context, size: AnswerCardSize, onTap: (View) -> Unit) {

    // The corner mark draws over the label unless the inset clears it.
    private val label = overlayText(context, size.labelSp, COLOR_TEXT).apply {
        val clear = context.dp(size.labelInsetDp)
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        maxLines = 1
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        setPaddingRelative(clear, 0, clear, 0)
        layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, context.dp(size.labelDp), Gravity.CENTER)
        fitOneLine(this, size.labelSp, size.minSp)
    }

    private val wrongMark = View(context).apply {
        background = WrongMark(context.dpf(AnswerCardShape.MARK_EDGE_DP))
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        layoutParams = cornerMark(context)
    }

    private val placedMark = overlayText(context, AnswerCardShape.MARK_SP, COLOR_PRIMARY).apply {
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        maxLines = 1
        background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setStroke(context.dpf(AnswerCardShape.MARK_EDGE_DP).toInt().coerceAtLeast(1), Color.parseColor(COLOR_PRIMARY))
        }
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        layoutParams = cornerMark(context)
        fitOneLine(this, AnswerCardShape.MARK_SP, AnswerCardShape.MARK_MIN_SP)
    }

    val frame: FrameLayout = FrameLayout(context).apply {
        minimumHeight = context.dp(size.minDp)
        isClickable = true
        isFocusable = true
        speaksAsButton()
        stateListAnimator = pressScale(this)
        addView(label)
        addView(wrongMark)
        addView(placedMark)
        setOnClickListener(onTap)
    }

    // `mark` is the number a placed card draws in its ring.
    fun show(state: AnswerCardState, text: String, spoken: String, mark: String? = null) {
        val context = frame.context
        label.text = text
        wrongMark.visibility = if (state == AnswerCardState.WRONG) View.VISIBLE else View.GONE
        placedMark.visibility = if (state == AnswerCardState.PLACED) View.VISIBLE else View.GONE
        placedMark.text = mark.orEmpty()
        frame.background = answerCardBackground(context, state)
        frame.isEnabled = state == AnswerCardState.REST
        frame.importantForAccessibility = if (state == AnswerCardState.PLACED) {
            View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        } else {
            View.IMPORTANT_FOR_ACCESSIBILITY_YES
        }
        frame.contentDescription =
            if (state == AnswerCardState.WRONG) context.getString(R.string.overlay_task_card_wrong, spoken) else spoken
    }

}

// A card's corner badge box, at its top end.
internal fun cornerMark(context: Context): FrameLayout.LayoutParams {
    val inset = context.dp(AnswerCardShape.MARK_INSET_DP)
    return FrameLayout.LayoutParams(
        context.dp(AnswerCardShape.MARK_DP), context.dp(AnswerCardShape.MARK_DP), Gravity.TOP or Gravity.END,
    ).apply { topMargin = inset; marginEnd = inset }
}
