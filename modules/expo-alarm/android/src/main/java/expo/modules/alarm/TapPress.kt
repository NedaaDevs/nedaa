package expo.modules.alarm

// Tap's press rule, as JS countsPress.
object TapPress {

    // JS TAP_PRESS_MIN_GAP_MS: a faster press is a bounce, not a tap.
    const val MIN_GAP_MS = 150L

    fun counts(lastCounted: Long?, now: Long): Boolean =
        lastCounted == null || now - lastCounted >= MIN_GAP_MS
}
