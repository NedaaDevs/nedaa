package expo.modules.alarm

// What a press on Tap's board does; ids as JS TAP_OUTCOME.
enum class TapOutcome(val id: String) {
    COUNTED("counted"),
    SOLVED("solved"),
    IGNORED("ignored"),
}

// Presses counted so far, and when the last of them landed.
data class TapBoardState(val done: Int = 0, val lastCounted: Long? = null)

data class TapPressResult(val outcome: TapOutcome, val state: TapBoardState)

// Tap's press rules, as JS countsPress, pressTap and tapStatusOf.
object TapPress {

    // JS TAP_PRESSES.
    const val PRESSES = 10

    // JS TAP_PRESS_MIN_GAP_MS: a faster press is a bounce, not a tap.
    const val MIN_GAP_MS = 150L

    fun counts(lastCounted: Long?, now: Long): Boolean =
        lastCounted == null || now - lastCounted >= MIN_GAP_MS

    // Solves on the PRESSES-th count; ignored once solved or too soon.
    fun press(state: TapBoardState, now: Long): TapPressResult {
        if (state.done >= PRESSES || !counts(state.lastCounted, now)) return TapPressResult(TapOutcome.IGNORED, state)
        val done = state.done + 1
        val outcome = if (done < PRESSES) TapOutcome.COUNTED else TapOutcome.SOLVED
        return TapPressResult(outcome, TapBoardState(done, now))
    }

    // The count a screen reader hears: each one between none and the last.
    fun statusOf(done: Int): Int? = if (done in 1 until PRESSES) done else null
}
