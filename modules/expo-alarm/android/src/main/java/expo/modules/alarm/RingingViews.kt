package expo.modules.alarm

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.os.Build
import android.text.Editable
import android.text.TextPaint
import android.text.TextWatcher
import android.text.format.DateFormat
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.accessibility.AccessibilityNodeInfo
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextClock
import android.widget.TextView
import java.util.Date
import kotlin.math.ceil

// The ringing figures, as JS RINGING_TYPE, RINGING_HALO and TASK_ENTER_MS.
internal object RingingLook {
    const val NAME_SP = 44f
    const val TIME_SP = 104f
    const val TIME_MIN_SP = 48f
    const val PERIOD_SP = 22f
    const val PERIOD_GAP_DP = 8
    const val LINE_SP = 18f
    const val HALO_SIZE_DP = 316
    const val HALO_RING_DP = 1.5f
    const val HALO_BREATH_MS = 2400L
    const val HALO_SCALE = 1.06f
    const val HALO_REST_OPACITY = 0.3f
    const val HALO_LOW_OPACITY = 0.08f
    const val ENTER_MS = 280L
    const val SNOOZE_MIN_DP = 64
    const val EDGE_DP = 1.5f
    const val CONTROL_RADIUS_DP = 12f
    const val CARD_RADIUS_DP = 16f
    const val MARK_DP = 40
    const val MARK_EDGE_DP = 2f
}

private fun accessibilityHeading(view: View) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) view.isAccessibilityHeading = true
}

// Moves TalkBack's focus once the view is laid out, as JS focusOn.
internal fun focusForReader(view: View) {
    view.post { view.performAccessibilityAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS, null) }
}

// A thin ring behind the time; it breathes while shown, as JS RingingHalo.
internal class RingingHalo(context: Context) : View(context) {

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = context.dpf(RingingLook.HALO_RING_DP)
        color = Color.parseColor(COLOR_PRIMARY)
    }

    private val breath = ValueAnimator.ofFloat(0f, 1f).apply {
        duration = RingingLook.HALO_BREATH_MS / 2
        repeatCount = ValueAnimator.INFINITE
        repeatMode = ValueAnimator.REVERSE
        interpolator = AccelerateDecelerateInterpolator()
        addUpdateListener { rest(it.animatedValue as Float) }
    }

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        rest(0f)
    }

    private fun rest(at: Float) {
        alpha = RingingLook.HALO_REST_OPACITY + (RingingLook.HALO_LOW_OPACITY - RingingLook.HALO_REST_OPACITY) * at
        val scale = 1f + (RingingLook.HALO_SCALE - 1f) * at
        scaleX = scale
        scaleY = scale
    }

    // The ring keeps its size where it fits, and room for its breath where not.
    override fun onDraw(canvas: Canvas) {
        val room = minOf(width, height) / RingingLook.HALO_SCALE
        val diameter = minOf(room, context.dpf(RingingLook.HALO_SIZE_DP.toFloat()))
        canvas.drawCircle(width / 2f, height / 2f, (diameter - paint.strokeWidth) / 2f, paint)
    }

    override fun onVisibilityAggregated(isVisible: Boolean) {
        super.onVisibilityAggregated(isVisible)
        if (isVisible && !animationsOff(context)) {
            if (!breath.isStarted) breath.start()
        } else {
            breath.cancel()
            rest(0f)
        }
    }

    override fun onDetachedFromWindow() {
        breath.cancel()
        super.onDetachedFromWindow()
    }
}

// The ringing header: the name, the time and the halo, as JS ActiveAlarmView.
internal class RingingHeaderView(private val context: Context, type: RingingScreen.Type) {

    // No prayer time is stored natively, so the clock heads the screen.
    private val header = RingingScreen.header(type, hasMoment = false)
    private val alarmName = context.getString(RingingStrings.of(header.alarm))
    private val prayerName = header.prayer?.let { context.getString(RingingStrings.of(it)) }

    private val announcer = spokenStatus(context)

    private val figure = TextClock(context).apply {
        format12Hour = "h:mm"
        format24Hour = "HH:mm"
        maxLines = 1
        textSize = RingingLook.TIME_SP
        setTextColor(Color.parseColor(COLOR_TEXT))
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        includeFontPadding = false
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    // The period shows on a 12-hour clock only, as JS time.period.
    private val period = TextClock(context).apply {
        format12Hour = "a"
        format24Hour = "a"
        textSize = RingingLook.PERIOD_SP
        setTextColor(Color.parseColor(COLOR_TEXT))
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        visibility = if (DateFormat.is24HourFormat(context)) View.GONE else View.VISIBLE
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { marginStart = context.dp(RingingLook.PERIOD_GAP_DP) }
    }

    private val timeRow = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER
        layoutParams = matchWidth()
        addView(figure)
        addView(period)
        addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> post { fitFigure() } }
    }

    private val heading = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        isFocusable = true
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        accessibilityHeading(this)
        layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER,
        )
        if (header.prayer != null) {
            addView(line(RingingLook.LINE_SP, COLOR_TEXT_MUTED).apply {
                text = context.getString(R.string.overlay_ringing_prayer_alarm)
            })
        }
        addView(line(RingingLook.NAME_SP, COLOR_TEXT).apply {
            text = context.getString(RingingStrings.of(header.name))
            setTypeface(typeface, Typeface.BOLD)
        })
        addView(timeRow)
        addView(announcer)
    }

    val view: View = FrameLayout(context).apply {
        layoutParams = matchWidth()
        minimumHeight = context.dp(RingingLook.HALO_SIZE_DP)
        addView(RingingHalo(context), FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
        ))
        addView(heading)
    }

    init {
        figure.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(text: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(text: CharSequence?, start: Int, before: Int, count: Int) = Unit
            override fun afterTextChanged(text: Editable?) {
                describe()
                timeRow.post { fitFigure() }
            }
        })
        describe()
    }

    // As JS adjustsFontSizeToFit: the figure shrinks to the room the period leaves.
    private fun fitFigure() {
        // Measured, not read: a figure that fills the row leaves the period no width.
        val periodRoom = if (period.visibility == View.GONE) 0 else {
            ceil(period.paint.measureText(period.text.toString())).toInt() +
                period.paddingLeft + period.paddingRight + context.dp(RingingLook.PERIOD_GAP_DP)
        }
        val room = timeRow.width - timeRow.paddingLeft - timeRow.paddingRight - periodRoom
        if (room <= 0) return
        val paint = TextPaint(figure.paint)
        val text = figure.text.toString()
        val metrics = context.resources.displayMetrics
        val sp = TextFit.sp(RingingLook.TIME_SP, RingingLook.TIME_MIN_SP) { size ->
            paint.textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, size, metrics)
            paint.measureText(text) <= room
        }
        val px = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sp, metrics)
        if (figure.textSize != px) figure.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
    }

    private fun line(sizeSp: Float, color: String): TextView = overlayText(context, sizeSp, color).apply {
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    // As JS: a prayer alarm on the clock says the time now; others say the alarm.
    private fun describe() {
        val spoken = DateFormat.getTimeFormat(context).format(Date())
        heading.contentDescription = when (header.heading) {
            RingingScreen.Heading.CURRENT_TIME -> context.getString(RingingStrings.of(header.heading), spoken)
            RingingScreen.Heading.RINGING_AT -> context.getString(RingingStrings.of(header.heading), alarmName, spoken)
        }
    }

    fun show() {
        view.visibility = View.VISIBLE
        announce()
    }

    fun hide() {
        view.visibility = View.GONE
    }

    // Said once per showing, as the JS screen says it on each mount.
    fun announce() {
        val message = when (header.announcement) {
            RingingScreen.Announcement.PRAYER -> context.getString(RingingStrings.of(header.announcement), prayerName)
            RingingScreen.Announcement.CUSTOM -> context.getString(RingingStrings.of(header.announcement))
        }
        announcer.say(null)
        announcer.post { announcer.say(message) }
    }
}

// Snooze, or one line in its place, as JS SnoozeSlot.
internal class SnoozeSlotView(
    private val context: Context,
    use: RingingScreen.SnoozeUse,
    minutes: Int,
    onSnooze: () -> Unit,
) {
    private val open = RingingScreen.snoozeOpen(use)
    private val place = RingingScreen.snoozePlace(open, use.enabled)

    val view: View = RingingStrings.of(place)?.let { line ->
        overlayText(context, RingingLook.LINE_SP, COLOR_TEXT_MUTED).apply {
            text = context.getString(line)
            minHeight = context.dp(RingingLook.SNOOZE_MIN_DP)
        }
    } ?: snoozeButton(minutes, RingingScreen.snoozeLeft(use), onSnooze)

    private fun snoozeButton(minutes: Int, left: Int, onSnooze: () -> Unit): View {
        val title = context.resources.getQuantityString(R.plurals.overlay_ringing_snooze, minutes, minutes)
        val count = context.resources.getQuantityString(R.plurals.overlay_ringing_snoozes_left, left, left)
        return LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            minimumHeight = context.dp(RingingLook.SNOOZE_MIN_DP)
            setPadding(context.dp(24), context.dp(12), context.dp(24), context.dp(12))
            background = cardFill(context, COLOR_SURFACE, COLOR_HAIRLINE, RingingLook.EDGE_DP, dashed = false).apply {
                cornerRadius = context.dpf(RingingLook.CONTROL_RADIUS_DP)
            }
            layoutParams = matchWidth().apply { topMargin = context.dp(12) }
            isClickable = true
            isFocusable = true
            contentDescription = context.getString(R.string.overlay_join, title, count)
            stateListAnimator = pressScale(this)
            speaksAsButton()
            setOnClickListener { onSnooze() }
            addView(overlayText(context, 20f, COLOR_TEXT).apply {
                text = title
                setTypeface(typeface, Typeface.BOLD)
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            })
            addView(overlayText(context, 16f, COLOR_TEXT_MUTED).apply {
                text = count
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            })
        }
    }
}

// A check in a ring, hidden from the reader, as the JS solved mark.
private class SolvedMark(context: Context) : View(context) {

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = context.dpf(RingingLook.MARK_EDGE_DP)
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        color = Color.parseColor(COLOR_TEXT)
    }

    private val check = Path()

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    override fun onDraw(canvas: Canvas) {
        val size = minOf(width, height).toFloat()
        val edge = paint.strokeWidth
        canvas.drawCircle(width / 2f, height / 2f, (size - edge) / 2f, paint)
        check.reset()
        check.moveTo(size * 0.3f, size * 0.52f)
        check.lineTo(size * 0.44f, size * 0.66f)
        check.lineTo(size * 0.7f, size * 0.38f)
        canvas.drawPath(check, paint)
    }
}

// After the last task: the alarm has stopped, and a way out, as JS SolvedPanel.
internal class SolvedPanelView(private val context: Context, onClose: () -> Unit) {

    private val title = overlayText(context, RingingLook.PERIOD_SP, COLOR_TEXT).apply {
        text = context.getString(R.string.overlay_solved_title)
        gravity = Gravity.START or Gravity.CENTER_VERTICAL
        setTypeface(typeface, Typeface.BOLD)
        isFocusable = true
        accessibilityHeading(this)
        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
            marginStart = context.dp(16)
        }
    }

    val view: View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(context.dp(20), context.dp(20), context.dp(20), context.dp(20))
        background = cardFill(context, COLOR_SURFACE, COLOR_HAIRLINE, RingingLook.EDGE_DP, dashed = false).apply {
            cornerRadius = context.dpf(RingingLook.CARD_RADIUS_DP)
        }
        layoutParams = matchWidth().apply { topMargin = context.dp(16) }
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = matchWidth()
            addView(SolvedMark(context), LinearLayout.LayoutParams(context.dp(RingingLook.MARK_DP), context.dp(RingingLook.MARK_DP)))
            addView(title)
        })
        addView(overlayButton(
            context,
            context.getString(R.string.overlay_close),
            COLOR_PRIMARY,
            COLOR_TEXT_ON_ACCENT,
        ).apply {
            layoutParams = matchWidth().apply { topMargin = context.dp(16) }
            stateListAnimator = pressScale(this)
            setOnClickListener { onClose() }
        })
    }

    // The solved board held the reader's focus, so focus moves to the title.
    fun shown() {
        fadeIn(view, RingingLook.ENTER_MS)
        focusForReader(title)
    }
}
