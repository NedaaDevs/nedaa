package expo.modules.alarm

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout

// A pad's shape on JS PatternPad's 24-unit square; a lit pad fills it.
internal class PatternShape(private val pad: PatternPad) : Drawable() {

    var ink: Int = Color.WHITE
        set(value) {
            field = value
            invalidateSelf()
        }

    var filled = false
        set(value) {
            field = value
            invalidateSelf()
        }

    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }

    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }

    private val path = Path().apply {
        when (pad) {
            PatternPad.CIRCLE -> addCircle(CENTRE, CENTRE, CIRCLE_R, Path.Direction.CW)
            PatternPad.TRIANGLE -> {
                moveTo(12f, 4.5f)
                lineTo(20f, 18.5f)
                lineTo(4f, 18.5f)
                close()
            }
            PatternPad.SQUARE -> addRoundRect(RectF(5f, 5f, 19f, 19f), 1.5f, 1.5f, Path.Direction.CW)
            PatternPad.LINES -> {
                moveTo(5f, 9f)
                lineTo(19f, 9f)
                moveTo(5f, 15f)
                lineTo(19f, 15f)
            }
        }
    }

    override fun draw(canvas: Canvas) {
        val box = bounds
        val save = canvas.save()
        canvas.translate(box.left.toFloat(), box.top.toFloat())
        canvas.scale(box.width() / VIEWBOX, box.height() / VIEWBOX)
        if (filled && fills(pad)) {
            fill.color = ink
            canvas.drawPath(path, fill)
        }
        stroke.color = ink
        canvas.drawPath(path, stroke)
        canvas.restoreToCount(save)
    }

    override fun setAlpha(alpha: Int) {
        stroke.alpha = alpha
        fill.alpha = alpha
    }

    override fun setColorFilter(colorFilter: ColorFilter?) {
        stroke.colorFilter = colorFilter
        fill.colorFilter = colorFilter
    }

    @Deprecated("Deprecated in Java")
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT

    companion object {
        // JS PATTERN_SHAPE_VIEWBOX's side and PATTERN_PAD_SIZE.STROKE, in its units.
        const val VIEWBOX = 24f
        const val STROKE = 3f

        private const val CENTRE = 12f
        private const val CIRCLE_R = 7.5f

        // JS PATTERN_PAD_FILLS: two lines have no inside to fill.
        fun fills(pad: PatternPad): Boolean = pad != PatternPad.LINES
    }
}

// One of the pattern board's four pads, as JS PatternPad: only a pad at
// rest takes a tap; a lit pad fills with the accent.
internal class PatternPadView(context: Context, pad: PatternPad, onTap: (View) -> Unit) {

    private val shape = PatternShape(pad)

    private val litFill = View(context).apply {
        background = GradientDrawable().apply {
            setColor(Color.parseColor(COLOR_PRIMARY))
            cornerRadius = context.dpf(AnswerCardShape.RADIUS_DP)
        }
        visibility = View.INVISIBLE
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
    }

    private val shapeView = View(context).apply {
        background = shape
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        layoutParams = FrameLayout.LayoutParams(context.dp(SHAPE_DP), context.dp(SHAPE_DP), Gravity.CENTER)
    }

    private val wrongMark = View(context).apply {
        background = WrongMark(context.dpf(AnswerCardShape.MARK_EDGE_DP))
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        visibility = View.GONE
        layoutParams = cornerMark(context)
    }

    private var lit = false

    val frame: FrameLayout = FrameLayout(context).apply {
        minimumHeight = context.dp(HEIGHT_DP)
        isClickable = true
        isFocusable = true
        speaksAsButton()
        stateListAnimator = pressScale(this)
        addView(litFill)
        addView(shapeView)
        addView(wrongMark)
        setOnClickListener(onTap)
    }

    // `fades` is off with animations off: the fill switches instead.
    fun show(state: PatternPadState, spoken: String, fades: Boolean) {
        val context = frame.context
        val nowLit = state == PatternPadState.LIT
        if (nowLit != lit) light(nowLit, fades)
        lit = nowLit
        shape.ink = Color.parseColor(if (nowLit) COLOR_TEXT_ON_ACCENT else COLOR_TEXT)
        shape.filled = nowLit
        wrongMark.visibility = if (state == PatternPadState.WRONG) View.VISIBLE else View.GONE
        frame.background = background(context, state)
        // Marked by its edge, fill and badge; a held pad is spoken as disabled.
        frame.isEnabled = state == PatternPadState.REST
        frame.contentDescription =
            if (state == PatternPadState.WRONG) context.getString(R.string.overlay_task_card_wrong, spoken) else spoken
    }

    private fun light(on: Boolean, fades: Boolean) {
        litFill.animate().cancel()
        if (!fades) {
            litFill.alpha = 1f
            litFill.visibility = if (on) View.VISIBLE else View.INVISIBLE
            return
        }
        litFill.visibility = View.VISIBLE
        if (on) litFill.alpha = 0f
        litFill.animate().alpha(if (on) 1f else 0f).setDuration(PatternBoardRun.FADE_MS).withEndAction {
            if (!on) litFill.visibility = View.INVISIBLE
        }.start()
    }

    private fun background(context: Context, state: PatternPadState): Drawable = when (state) {
        PatternPadState.LIT -> cardFill(context, COLOR_SURFACE, COLOR_PRIMARY, LIT_EDGE_DP, dashed = false)
        PatternPadState.WRONG ->
            cardFill(context, COLOR_SURFACE, COLOR_ERROR, AnswerCardShape.WRONG_EDGE_DP, dashed = true)
        PatternPadState.HELD -> cardFill(context, COLOR_SURFACE, COLOR_HAIRLINE, AnswerCardShape.EDGE_DP, false)
        PatternPadState.REST -> StateListDrawable().apply {
            val pressed = cardFill(context, COLOR_PRESSED, COLOR_TEXT, PRESSED_EDGE_DP, false)
            addState(intArrayOf(android.R.attr.state_pressed), pressed)
            addState(intArrayOf(), cardFill(context, COLOR_SURFACE, COLOR_HAIRLINE, AnswerCardShape.EDGE_DP, false))
        }
    }

    companion object {
        // JS PATTERN_PAD_SIZE.HEIGHT and SHAPE.
        const val HEIGHT_DP = 148
        const val SHAPE_DP = 64

        // JS PatternPad's lit edge and pressed edge.
        private const val LIT_EDGE_DP = 3f
        private const val PRESSED_EDGE_DP = 2.5f
    }
}
