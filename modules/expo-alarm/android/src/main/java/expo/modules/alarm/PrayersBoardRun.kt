package expo.modules.alarm

// What the places say of a prayer, as JS PRAYER_PLACE_PART.
enum class PlacePart(val id: String) {
    AFTER_MISS("afterMiss"),
    FILLED("filled"),
    EMPTY("empty"),
}

data class PlaceSaid(val part: PlacePart, val prayer: PrayerId)

// The line under the places, as JS PRAYER_LINE; two of them name a prayer.
sealed interface PrayersLine {
    val id: String
    val prayer: PrayerId? get() = null

    data object None : PrayersLine {
        override val id = "none"
    }

    data object Dealt : PrayersLine {
        override val id = "dealt"
    }

    data class Wrong(override val prayer: PrayerId) : PrayersLine {
        override val id = "wrong"
    }

    data class DealtNext(override val prayer: PrayerId) : PrayersLine {
        override val id = "dealtNext"
    }
}

// `wrong` is the slot held as wrong; `missed` the prayer tapped too soon,
// until the next placement; `deals` counts redeals.
data class PrayersBoardState(
    val order: PrayerBoardState,
    val wrong: Int?,
    val missed: PrayerId?,
    val deals: Int,
    val solved: Boolean,
) {
    fun cardState(slot: Int): AnswerCardState = when {
        order.isPlaced(slot) -> AnswerCardState.PLACED
        wrong == null -> AnswerCardState.REST
        wrong == slot -> AnswerCardState.WRONG
        else -> AnswerCardState.HELD
    }

    // Reads no slot of the redeal, so a moved card and a kept one read alike.
    val line: PrayersLine
        get() = when {
            wrong != null -> PrayersLine.Wrong(order.deal[wrong])
            missed == null -> PrayersLine.None
            order.placed == 0 -> PrayersLine.Dealt
            else -> PrayersLine.DealtNext(PrayerId.entries[order.placed - 1])
        }

    // The places' label: the missed prayer, each filled place, then the next.
    val placesSpoken: List<PlaceSaid>
        get() = listOfNotNull(missed?.let { PlaceSaid(PlacePart.AFTER_MISS, it) }) +
            PrayerId.entries.take(order.placed).map { PlaceSaid(PlacePart.FILLED, it) } +
            emptyNext

    // Said once a card is placed: its place, then the empty one after it.
    val placedSaid: List<PlaceSaid>
        get() = if (order.placed == 0) emptyList()
        else listOf(PlaceSaid(PlacePart.FILLED, PrayerId.entries[order.placed - 1])) + emptyNext

    private val emptyNext: List<PlaceSaid>
        get() = listOfNotNull(PrayerId.entries.getOrNull(order.placed)?.let { PlaceSaid(PlacePart.EMPTY, it) })
}

sealed interface PrayersTap {
    val state: PrayersBoardState? get() = null

    data class Placed(override val state: PrayersBoardState) : PrayersTap
    data class Done(override val state: PrayersBoardState) : PrayersTap
    data class Wrong(override val state: PrayersBoardState) : PrayersTap
    data object Ignored : PrayersTap
}

// The prayers board's taps and redeals, as src/utils/prayersBoard.ts plays
// them. prayers-board.tsv pins the two.
object PrayersBoardRun {

    fun start(rng: TaskRng.Rng): PrayersBoardState =
        PrayersBoardState(PrayerOrder.startBoard(rng), wrong = null, missed = null, deals = 0, solved = false)

    // Only an open card on an unsolved board with no card held takes a tap.
    fun tap(state: PrayersBoardState, slot: Int): PrayersTap {
        if (state.solved || state.wrong != null) return PrayersTap.Ignored
        return when (val tap = PrayerOrder.tap(state.order, slot)) {
            PrayerTap.Ignored -> PrayersTap.Ignored
            PrayerTap.Wrong -> PrayersTap.Wrong(state.copy(wrong = slot))
            is PrayerTap.Placed -> PrayersTap.Placed(state.copy(order = tap.state, missed = null))
            is PrayerTap.Done -> PrayersTap.Done(state.copy(order = tap.state, missed = null, solved = true))
        }
    }

    // Ends a wrong card's hold: the open cards are dealt again, progress kept.
    fun endHold(state: PrayersBoardState, rng: TaskRng.Rng): PrayersBoardState {
        val wrong = state.wrong ?: return state
        return state.copy(
            order = PrayerOrder.reshuffleUnplaced(state.order, rng),
            wrong = null,
            missed = state.order.deal[wrong],
            deals = state.deals + 1,
        )
    }
}
