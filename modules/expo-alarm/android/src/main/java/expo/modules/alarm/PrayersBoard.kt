package expo.modules.alarm

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.LinearLayout
import android.widget.TextView

// Prayers in order, as JS PrayersBoard, drawing what PrayersBoardRun decides:
// a wrong card holds, then the open cards are dealt again.
class PrayersBoard(context: Context, input: BoardInput, private val host: BoardHost) : TaskBoard {

    private val rng = input.rng

    private var state = PrayersBoardRun.start(rng)

    private val handler = Handler(Looper.getMainLooper())

    private val endHold = Runnable { redeal() }

    private val focusPlaces = Runnable {
        places.performAccessibilityAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS, null)
    }

    private val ask = overlayText(context, LINE_SP, COLOR_TEXT_MUTED).apply {
        text = context.getString(
            R.string.overlay_task_prayers_ask,
            nameOf(context, PrayerId.entries.first()),
            nameOf(context, PrayerId.entries.last()),
        )
    }

    // One place: its number over its prayer's name, or a dash while empty.
    private class Place(val box: LinearLayout, val name: TextView)

    private val placeViews = PrayerId.entries.mapIndexed { place, _ -> place(context, place) }

    // One reader node for all five; each place is drawn only.
    private val places = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        layoutParams = matchWidth().apply { topMargin = context.dp(GAP_DP) }
        isFocusable = true
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        placeViews.forEachIndexed { place, view ->
            addView(view.box, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                if (place > 0) marginStart = context.dp(PLACE_GAP_DP)
            })
        }
    }

    private val line = overlayText(context, LINE_SP, COLOR_TEXT_MUTED).apply {
        typeface = Typeface.create(MEDIUM, Typeface.NORMAL)
        minHeight = context.dp(LINE_MIN_DP)
    }

    private val cards = PrayerId.entries.indices.map { slot ->
        AnswerCardView(context, CARD_SIZE) { choose(it, slot) }
    }

    // Two columns; the fifth card takes the last row whole.
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

    // Says each placement but the last; the shell speaks the solve.
    private val status = spokenStatus(context)

    override val view: View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = matchWidth()
        addView(ask)
        addView(places)
        addView(line, matchWidth().apply { topMargin = context.dp(GAP_DP); bottomMargin = context.dp(GAP_DP) })
        addView(grid)
        addView(status)
    }

    init {
        show()
    }

    override fun release() {
        handler.removeCallbacks(endHold)
        handler.removeCallbacks(focusPlaces)
    }

    private fun place(context: Context, place: Int): Place {
        val number = overlayText(context, PLACE_NUMBER_SP, COLOR_TEXT_MUTED).apply {
            typeface = Typeface.create(MEDIUM, Typeface.NORMAL)
            text = localeNumber(place + 1)
        }
        val name = overlayText(context, PLACE_NAME_SP, COLOR_TEXT).apply {
            typeface = Typeface.create(MEDIUM, Typeface.NORMAL)
            maxLines = 1
            // The full line at the phone's font scale, so no script is clipped.
            val line = paint.fontMetricsInt.let { it.bottom - it.top }
            val height = maxOf(context.dp(PLACE_NAME_DP), line)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, height)
            fitOneLine(this, PLACE_NAME_SP, PLACE_NAME_MIN_SP)
        }
        val box = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            minimumHeight = context.dp(PLACE_MIN_DP)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            setPadding(context.dp(PLACE_INSET_DP), context.dp(PLACE_PAD_DP), context.dp(PLACE_INSET_DP), context.dp(PLACE_PAD_DP))
            addView(number)
            addView(name)
        }
        return Place(box, name)
    }

    private fun choose(card: View, slot: Int) {
        when (val tap = PrayersBoardRun.tap(state, slot)) {
            PrayersTap.Ignored -> return
            is PrayersTap.Wrong -> {
                state = tap.state
                card.performHapticFeedback(OverlayHaptic.REJECT)
                status.say(null)
                show()
                handler.postDelayed(endHold, MathBoardRun.WRONG_HOLD_MS)
            }
            is PrayersTap.Placed -> {
                val filled = state.order.placed
                state = tap.state
                card.performHapticFeedback(OverlayHaptic.PRESS)
                show()
                fadeIn(placeViews[filled].name, PLACE_FILL_MS)
                status.say(spoken(tap.state.placedSaid))
            }
            is PrayersTap.Done -> {
                val filled = state.order.placed
                state = tap.state
                card.performHapticFeedback(OverlayHaptic.CONFIRM)
                show()
                fadeIn(placeViews[filled].name, PLACE_FILL_MS)
                host.onSolved()
            }
        }
    }

    private fun redeal() {
        state = PrayersBoardRun.endHold(state, rng)
        show()
        cards.forEachIndexed { slot, card ->
            if (state.cardState(slot) != AnswerCardState.PLACED) fadeIn(card.frame, MathCardsBoard.SWAP_IN_MS)
        }
        handler.post(focusPlaces)
    }

    private fun show() {
        val context = view.context
        places.contentDescription = spoken(state.placesSpoken)
        placeViews.forEachIndexed { place, view -> showPlace(view, PrayerId.entries[place], place) }
        line.text = when (val shown = state.line) {
            PrayersLine.None -> ""
            PrayersLine.Dealt -> context.getString(R.string.overlay_task_prayers_dealt)
            is PrayersLine.Wrong -> context.getString(R.string.overlay_task_prayers_wrong, nameOf(context, shown.prayer))
            is PrayersLine.DealtNext ->
                context.getString(R.string.overlay_task_prayers_dealt_next, nameOf(context, shown.prayer))
        }
        cards.forEachIndexed { slot, card ->
            val prayer = state.order.deal[slot]
            val name = nameOf(context, prayer)
            card.show(state.cardState(slot), name, name, localeNumber(prayer.ordinal + 1))
        }
    }

    private fun showPlace(place: Place, prayer: PrayerId, at: Int) {
        val context = place.box.context
        val filled = at < state.order.placed
        val next = at == state.order.placed
        place.name.text = if (filled) nameOf(context, prayer) else PLACE_EMPTY
        place.name.setTextColor(Color.parseColor(if (filled) COLOR_TEXT else COLOR_TEXT_MUTED))
        place.box.background = GradientDrawable().apply {
            cornerRadius = context.dpf(PLACE_RADIUS_DP)
            if (filled) setColor(Color.parseColor(COLOR_SURFACE))
            val edge = context.dpf(if (next) PLACE_NEXT_EDGE_DP else PLACE_EDGE_DP).toInt().coerceAtLeast(1)
            val dash = if (filled || next) 0f else context.dpf(AnswerCardShape.DASH_DP)
            val tone = when {
                next -> COLOR_PRIMARY
                filled -> COLOR_TEXT
                else -> COLOR_HAIRLINE
            }
            setStroke(edge, Color.parseColor(tone), dash, dash)
        }
    }

    // Spoken sentences, each ending in its own stop, read as one label.
    private fun spoken(said: List<PlaceSaid>): String = said.joinToString(" ") { sentence(it) }

    private fun sentence(said: PlaceSaid): String {
        val context = view.context
        val name = nameOf(context, said.prayer)
        return when (said.part) {
            PlacePart.AFTER_MISS -> context.getString(R.string.overlay_task_prayers_after_miss, name)
            PlacePart.FILLED -> context.getString(placeIdOf(said.prayer).filled, name)
            PlacePart.EMPTY -> context.getString(placeIdOf(said.prayer).empty)
        }
    }

    private fun fadeIn(part: View, ms: Long) {
        part.alpha = 0f
        part.animate().alpha(1f).setDuration(ms).start()
    }

    companion object {
        // JS PRAYER_PLACE_FILL_MS.
        const val PLACE_FILL_MS = 160L

        // JS PRAYER_PLACE_EMPTY.
        internal const val PLACE_EMPTY = "–"

        private const val MEDIUM = "sans-serif-medium"

        // JS sizes: lg lines, the line's $12, a place's helper number over md
        // name, its $16 height and $1.5 / $0.5 padding, a word card's 72.
        private const val LINE_SP = 16f
        private const val LINE_MIN_DP = 48
        private const val PLACE_NUMBER_SP = 13f
        private const val PLACE_NAME_SP = 14f
        private const val PLACE_MIN_DP = 64
        private const val PLACE_PAD_DP = 6
        // Clears the place's edge, which draws inside the box.
        private const val PLACE_INSET_DP = 2
        private const val PLACE_GAP_DP = 6
        private const val PLACE_RADIUS_DP = 12f
        private const val PLACE_EDGE_DP = 1.5f
        private const val PLACE_NEXT_EDGE_DP = 2.5f
        private const val CARD_SP = 22f
        private const val CARD_MIN_DP = 72

        // How far a name shrinks on a narrow, enlarged screen, and the boxes
        // that bound auto-size.
        private const val PLACE_NAME_MIN_SP = 6f
        private const val PLACE_NAME_DP = 24
        private const val CARD_MIN_SP = 12f
        private const val CARD_LABEL_DP = 48

        // JS $stack, between the parts and between cards.
        private const val GAP_DP = 12
        private const val COLUMNS = 2

        // JS AnswerCard's $stack; the placed mark draws over the label.
        private const val CARD_INSET_DP = 12

        private val CARD_SIZE = AnswerCardSize(CARD_SP, CARD_MIN_SP, CARD_LABEL_DP, CARD_MIN_DP, CARD_INSET_DP)
    }
}

// A prayer's name, as RN's prayerTimes keys say it.
internal fun nameIdOf(prayer: PrayerId): Int = when (prayer) {
    PrayerId.FAJR -> R.string.overlay_prayer_fajr
    PrayerId.DHUHR -> R.string.overlay_prayer_dhuhr
    PrayerId.ASR -> R.string.overlay_prayer_asr
    PrayerId.MAGHRIB -> R.string.overlay_prayer_maghrib
    PrayerId.ISHA -> R.string.overlay_prayer_isha
}

internal fun nameOf(context: Context, prayer: PrayerId): String = context.getString(nameIdOf(prayer))

// What a prayer's place is called empty and filled, as JS PRAYER_PLACE_KEY.
internal class PlaceCopy(val empty: Int, val filled: Int)

internal fun placeIdOf(prayer: PrayerId): PlaceCopy = when (prayer) {
    PrayerId.FAJR -> PlaceCopy(R.string.overlay_task_prayers_empty_fajr, R.string.overlay_task_prayers_filled_fajr)
    PrayerId.DHUHR -> PlaceCopy(R.string.overlay_task_prayers_empty_dhuhr, R.string.overlay_task_prayers_filled_dhuhr)
    PrayerId.ASR -> PlaceCopy(R.string.overlay_task_prayers_empty_asr, R.string.overlay_task_prayers_filled_asr)
    PrayerId.MAGHRIB ->
        PlaceCopy(R.string.overlay_task_prayers_empty_maghrib, R.string.overlay_task_prayers_filled_maghrib)
    PrayerId.ISHA -> PlaceCopy(R.string.overlay_task_prayers_empty_isha, R.string.overlay_task_prayers_filled_isha)
}
