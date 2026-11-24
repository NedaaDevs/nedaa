package expo.modules.alarm

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.text.format.DateFormat
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.AccessibilityDelegateCompat
import androidx.core.view.ViewCompat
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat
import java.util.Date
import java.util.Locale

// The quiet's look, as JS EmergencyQuiet and QuietBanner.
internal object QuietLook {
    const val GAP_DP = 12
    const val PAD_DP = 16
    const val PANEL_EDGE_DP = 2f
    const val BANNER_EDGE_DP = 2.5f
    const val GO_EDGE_DP = 2f
    const val TITLE_SP = 20f
    const val BODY_SP = 16f
    const val BUTTON_SP = 18f
    const val BANNER_SP = 15f
    const val ICON_DP = 24
    const val ICON_STROKE = 2f
    const val ICON_VIEWBOX = 24f
    const val BANNER_PAD_V_DP = 8
    const val CLEAR = "#00000000"
}

// Moves a view into a slot, out of wherever it stood.
internal fun View.moveTo(slot: ViewGroup) {
    if (parent === slot) return
    (parent as? ViewGroup)?.removeView(this)
    slot.addView(this)
}

internal fun quietSlot(context: Context): FrameLayout = FrameLayout(context).apply { layoutParams = matchWidth() }

// A button TalkBack names with a hint.
private fun View.speaksAsButtonWithHint(hint: String) {
    ViewCompat.setAccessibilityDelegate(this, object : AccessibilityDelegateCompat() {
        override fun onInitializeAccessibilityNodeInfo(host: View, info: AccessibilityNodeInfoCompat) {
            super.onInitializeAccessibilityNodeInfo(host, info)
            info.className = Button::class.java.name
            info.hintText = hint
        }
    })
}

// A speaker struck through, hidden from the reader, as lucide VolumeX.
private class VolumeXMark(context: Context) : View(context) {

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        color = Color.parseColor(COLOR_TEXT)
    }

    private val speaker = Path().apply {
        moveTo(11f, 5f)
        lineTo(6f, 9f)
        lineTo(2f, 9f)
        lineTo(2f, 15f)
        lineTo(6f, 15f)
        lineTo(11f, 19f)
        close()
    }

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        val side = context.dp(QuietLook.ICON_DP)
        layoutParams = LinearLayout.LayoutParams(side, side).apply { marginEnd = context.dp(QuietLook.GAP_DP) }
    }

    override fun onDraw(canvas: Canvas) {
        val unit = width / QuietLook.ICON_VIEWBOX
        paint.strokeWidth = QuietLook.ICON_STROKE
        canvas.save()
        canvas.scale(unit, unit)
        canvas.drawPath(speaker, paint)
        canvas.drawLine(22f, 9f, 16f, 15f, paint)
        canvas.drawLine(16f, 9f, 22f, 15f, paint)
        canvas.restore()
    }
}

// The running quiet and the time the alarm rings again, as JS QuietBanner;
// its status says the quiet was used once the alarm rings again.
internal class QuietBannerView(private val context: Context) {

    private val line = overlayText(context, QuietLook.BANNER_SP, COLOR_TEXT).apply {
        gravity = Gravity.START or Gravity.CENTER_VERTICAL
        setTypeface(typeface, Typeface.BOLD)
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
    }

    private val banner = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        minimumHeight = context.dp(MIN_TARGET_DP)
        val vertical = context.dp(QuietLook.BANNER_PAD_V_DP)
        val side = context.dp(QuietLook.PAD_DP)
        setPadding(side, vertical, side, vertical)
        background = cardFill(context, COLOR_SURFACE, COLOR_TEXT, QuietLook.BANNER_EDGE_DP, dashed = false).apply {
            cornerRadius = context.dpf(RingingLook.CARD_RADIUS_DP)
        }
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        isFocusable = true
        layoutParams = matchWidth().apply { bottomMargin = context.dp(QuietLook.GAP_DP) }
        visibility = View.GONE
        addView(VolumeXMark(context))
        addView(line)
    }

    private val ended = spokenStatus(context)

    val view: View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = matchWidth()
        addView(banner)
        addView(ended)
    }

    // It replaces the confirm under the reader's focus, so focus moves to it.
    fun show(until: Long) {
        val time = DateFormat.getTimeFormat(context).format(Date(until))
        val text = context.getString(R.string.overlay_quiet_banner, time)
        line.text = text
        banner.contentDescription = text
        ended.say(null)
        if (banner.visibility != View.VISIBLE) {
            banner.visibility = View.VISIBLE
            focusForReader(banner)
        }
    }

    fun hide() {
        val wasShown = banner.visibility == View.VISIBLE
        banner.visibility = View.GONE
        if (wasShown) ended.say(context.getString(R.string.overlay_quiet_used))
    }
}

// What the quiet shows for one alarm: the offer, its confirm, or why not.
internal data class QuietShown(
    val offer: EmergencyQuiet.Offer,
    val confirmOpen: Boolean,
    val failed: Boolean,
    val quieting: Boolean,
    val refillsOn: Long,
)

// The offer, its two-press confirm, or why not, as JS EmergencyQuiet.
internal class EmergencyQuietView(private val context: Context, private val listener: Listener) {

    interface Listener {
        fun onOpen()
        fun onBack()
        fun onConfirm()
    }

    private val handler = Handler(Looper.getMainLooper())

    private var wait = EmergencyQuiet.CONFIRM_WAIT_SECONDS

    private var shown: QuietShown? = null

    private val go = context.getString(R.string.overlay_quiet_confirm_go)

    private val failedLine = context.getString(R.string.overlay_quiet_failed)

    private val button = overlayText(context, BODY_SP, COLOR_TEXT_MUTED).apply {
        text = context.getString(R.string.overlay_quiet_button)
        paintFlags = paintFlags or Paint.UNDERLINE_TEXT_FLAG
        minHeight = context.dp(MIN_TARGET_DP)
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { gravity = Gravity.CENTER_HORIZONTAL; topMargin = context.dp(QuietLook.GAP_DP) }
        setPadding(context.dp(QuietLook.PAD_DP), 0, context.dp(QuietLook.PAD_DP), 0)
        isClickable = true
        isFocusable = true
        contentDescription = text
        speaksAsButtonWithHint(context.getString(R.string.overlay_quiet_hint))
        setOnClickListener { listener.onOpen() }
    }

    private val line = overlayText(context, BODY_SP, COLOR_TEXT_MUTED).apply {
        layoutParams = matchWidth().apply { topMargin = context.dp(QuietLook.GAP_DP) }
    }

    private val title = overlayText(context, QuietLook.TITLE_SP, COLOR_TEXT).apply {
        text = context.getString(R.string.overlay_quiet_confirm_title)
        gravity = Gravity.START
        setTypeface(typeface, Typeface.BOLD)
        isFocusable = true
        accessibilityHeading(this)
    }

    private val body = overlayText(context, BODY_SP, COLOR_TEXT).apply {
        text = context.resources.getQuantityString(
            R.plurals.overlay_quiet_confirm_body, EmergencyQuiet.MINUTES, EmergencyQuiet.MINUTES,
        )
        gravity = Gravity.START
    }

    private val cost = overlayText(context, BODY_SP, COLOR_TEXT_MUTED).apply {
        gravity = Gravity.START
    }

    private val back = choice(context.getString(R.string.overlay_quiet_back)).apply {
        setOnClickListener { listener.onBack() }
    }

    private val waitDigit = overlayText(context, QuietLook.BUTTON_SP, COLOR_TEXT_MUTED).apply {
        setTypeface(typeface, Typeface.BOLD)
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { marginEnd = context.dp(8) }
    }

    private val goLabel = overlayText(context, QuietLook.BUTTON_SP, COLOR_TEXT_MUTED).apply {
        text = go
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT,
        )
    }

    private val goButton = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER
        minimumHeight = context.dp(MIN_TARGET_DP)
        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            .apply { marginStart = context.dp(QuietLook.GAP_DP) }
        isClickable = true
        isFocusable = true
        contentDescription = go
        speaksAsButton()
        addView(waitDigit)
        addView(goLabel)
        setOnClickListener { if (pressable()) listener.onConfirm() }
    }

    private val readySpoken = spokenStatus(context)

    private val failedSpoken = spokenStatus(context)

    private val confirm = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        val pad = context.dp(QuietLook.PAD_DP)
        setPadding(pad, pad, pad, pad)
        background = cardFill(context, COLOR_SURFACE, COLOR_TEXT, QuietLook.PANEL_EDGE_DP, dashed = false).apply {
            cornerRadius = context.dpf(RingingLook.CARD_RADIUS_DP)
        }
        layoutParams = matchWidth().apply { topMargin = context.dp(QuietLook.GAP_DP) }
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = matchWidth().apply { topMargin = context.dp(QuietLook.GAP_DP) }
            addView(back)
            addView(goButton)
        }
        listOf(title, body, cost, row).forEachIndexed { index, part ->
            if (index in 1..2) (part.layoutParams as LinearLayout.LayoutParams).topMargin = context.dp(QuietLook.GAP_DP)
            addView(part)
        }
        addView(readySpoken)
        addView(failedSpoken)
    }

    val view: View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = matchWidth()
        listOf(button, line, confirm).forEach {
            it.visibility = View.GONE
            addView(it)
        }
    }

    private val countdown = object : Runnable {
        override fun run() {
            if (wait <= 0) return
            wait -= 1
            renderConfirm()
            if (wait > 0) handler.postDelayed(this, SECOND_MS)
        }
    }

    fun show(next: QuietShown) {
        val was = shown
        shown = next
        val offered = next.offer == EmergencyQuiet.Offer.OFFER
        val confirming = offered && next.confirmOpen
        button.visibility = if (offered && !confirming) View.VISIBLE else View.GONE
        confirm.visibility = if (confirming) View.VISIBLE else View.GONE
        val note = when (next.offer) {
            EmergencyQuiet.Offer.NONE_LEFT -> context.getString(R.string.overlay_quiet_none_left, dayMonth(next.refillsOn))
            EmergencyQuiet.Offer.USED -> context.getString(R.string.overlay_quiet_used)
            else -> null
        }
        line.text = note.orEmpty()
        line.visibility = if (note == null) View.GONE else View.VISIBLE
        val wasConfirming = was?.offer == EmergencyQuiet.Offer.OFFER && was.confirmOpen
        if (confirming && !wasConfirming) openConfirm()
        if (!confirming && wasConfirming) closeConfirm(focusButton = offered)
        if (confirming) renderConfirm()
    }

    fun release() {
        handler.removeCallbacksAndMessages(null)
    }

    private fun openConfirm() {
        wait = EmergencyQuiet.CONFIRM_WAIT_SECONDS
        readySpoken.say(null)
        failedSpoken.say(null)
        handler.removeCallbacks(countdown)
        handler.postDelayed(countdown, SECOND_MS)
        focusForReader(title)
    }

    // Back returns the reader's focus to the button that opened it.
    private fun closeConfirm(focusButton: Boolean) {
        handler.removeCallbacks(countdown)
        readySpoken.say(null)
        failedSpoken.say(null)
        if (focusButton) focusForReader(button)
    }

    private fun pressable(): Boolean = wait == 0 && shown?.quieting != true

    private fun renderConfirm() {
        val failed = shown?.failed == true
        val ready = wait == 0
        cost.text = if (failed) failedLine else context.getString(R.string.overlay_quiet_confirm_cost)
        cost.setTextColor(Color.parseColor(if (failed) COLOR_TEXT else COLOR_TEXT_MUTED))
        cost.setTypeface(null, if (failed) Typeface.BOLD else Typeface.NORMAL)
        waitDigit.text = localeNumber(wait)
        waitDigit.visibility = if (ready) View.GONE else View.VISIBLE
        val ink = if (ready) COLOR_TEXT else COLOR_TEXT_MUTED
        goLabel.setTextColor(Color.parseColor(ink))
        goButton.background = cardFill(context, QuietLook.CLEAR, ink, QuietLook.GO_EDGE_DP, dashed = !ready).apply {
            cornerRadius = context.dpf(RingingLook.CONTROL_RADIUS_DP)
        }
        goButton.isEnabled = pressable()
        readySpoken.say(if (ready && !failed) context.getString(R.string.overlay_quiet_ready, go) else null)
        failedSpoken.say(if (failed) failedLine else null)
    }

    private fun choice(label: String): TextView = overlayText(context, QuietLook.BUTTON_SP, COLOR_TEXT).apply {
        text = label
        minHeight = context.dp(MIN_TARGET_DP)
        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        background = cardFill(context, QuietLook.CLEAR, COLOR_TEXT_MUTED, RingingLook.EDGE_DP, dashed = false).apply {
            cornerRadius = context.dpf(RingingLook.CONTROL_RADIUS_DP)
        }
        isClickable = true
        isFocusable = true
        stateListAnimator = pressScale(this)
        speaksAsButton()
    }

    // As JS useDayMonth: the day and the month's name, in the device's locale.
    private fun dayMonth(at: Long): String {
        val locale = Locale.getDefault()
        return DateFormat.format(DateFormat.getBestDateTimePattern(locale, DAY_MONTH), Date(at)).toString()
    }

    private companion object {
        const val BODY_SP = QuietLook.BODY_SP
        const val SECOND_MS = 1_000L
        const val DAY_MONTH = "dMMMM"
    }
}
