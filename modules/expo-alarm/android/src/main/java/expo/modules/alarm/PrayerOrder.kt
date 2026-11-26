package expo.modules.alarm

// The five prayers in time order, by the JS PRAYER_ID values.
enum class PrayerId(val id: String) {
    FAJR("fajr"),
    DHUHR("dhuhr"),
    ASR("asr"),
    MAGHRIB("maghrib"),
    ISHA("isha"),
}

// The prayer each card place holds, in reading order, and how many from
// Fajr are placed.
data class PrayerBoardState(val deal: List<PrayerId>, val placed: Int) {
    fun isPlaced(slot: Int): Boolean = deal[slot].ordinal < placed

    // The slots still to place, in reading order.
    val unplacedSlots: List<Int>
        get() = deal.indices.filter { !isPlaced(it) }
}

sealed interface PrayerTap {
    data class Placed(val state: PrayerBoardState) : PrayerTap
    data class Done(val state: PrayerBoardState) : PrayerTap
    data object Wrong : PrayerTap
    data object Ignored : PrayerTap
}

// The prayers board's deals and taps, as src/utils/prayerOrder.ts plays
// them. prayer-order.tsv pins the two.
object PrayerOrder {

    // The ordering of `items` at `rank` in lexicographic order; 0 keeps it.
    fun <T> orderingAt(items: List<T>, rank: Int): List<T> {
        val left = items.toMutableList()
        var rest = rank
        return items.indices.map { index ->
            val block = factorial(items.size - 1 - index)
            val pick = rest / block
            rest %= block
            left.removeAt(pick)
        }
    }

    // Any ordering of the five but the one in order, each alike.
    fun dealPrayers(rng: TaskRng.Rng): List<PrayerId> =
        orderingAt(PrayerId.entries, TaskRng.drawInt(rng, 1, factorial(PrayerId.entries.size) - 1))

    fun startBoard(rng: TaskRng.Rng): PrayerBoardState = PrayerBoardState(dealPrayers(rng), 0)

    fun tap(state: PrayerBoardState, slot: Int): PrayerTap {
        if (state.isPlaced(slot)) return PrayerTap.Ignored
        if (state.deal[slot] != PrayerId.entries[state.placed]) return PrayerTap.Wrong
        val next = state.copy(placed = state.placed + 1)
        return if (next.placed == PrayerId.entries.size) PrayerTap.Done(next) else PrayerTap.Placed(next)
    }

    // Deals the unplaced cards again over their slots, whatever their order.
    fun reshuffleUnplaced(state: PrayerBoardState, rng: TaskRng.Rng): PrayerBoardState {
        val open = state.unplacedSlots
        val dealt = orderingAt(open.map { state.deal[it] }, TaskRng.drawInt(rng, 0, factorial(open.size) - 1))
        val deal = state.deal.mapIndexed { slot, prayer ->
            val at = open.indexOf(slot)
            if (at == -1) prayer else dealt[at]
        }
        return state.copy(deal = deal)
    }

    private fun factorial(n: Int): Int = if (n <= 1) 1 else n * factorial(n - 1)
}
