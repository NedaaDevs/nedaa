package expo.modules.alarm

// The overlay's grace window: a touch quiets the alarm, and a window with no
// touch ends with the sound back on. Clock and scheduler are injected.
class GraceTimer(
    private val durationMs: Long,
    private val now: () -> Long,
    private val scheduler: Scheduler,
    private val listener: Listener,
) {
    interface Scheduler {
        fun postDelayed(delayMs: Long, action: () -> Unit)
        // Cancels only what this timer posted.
        fun cancelAll()
    }

    interface Listener {
        fun onSilence()
        fun onTick(remainingMs: Long)
        fun onExpired()
    }

    companion object {
        const val TICK_MS = 50L
    }

    private var deadline: Long? = null

    // A touch opens a window and quiets if none was open; none at length 0.
    fun interact() {
        if (durationMs <= 0) return
        val quiet = deadline == null
        open()
        if (quiet) listener.onSilence()
    }

    // A solved round opens a fresh window, so an untouched round still expires.
    // After expiry the sound already rings, so only a touch reopens it.
    fun nextRound() {
        if (deadline == null) return
        open()
    }

    fun stop() {
        scheduler.cancelAll()
        deadline = null
    }

    private fun open() {
        scheduler.cancelAll()
        deadline = now() + durationMs
        listener.onTick(durationMs)
        scheduler.postDelayed(TICK_MS, ::tick)
    }

    private fun tick() {
        val end = deadline ?: return
        val remaining = end - now()
        if (remaining <= 0) {
            deadline = null
            listener.onExpired()
        } else {
            listener.onTick(remaining)
            scheduler.postDelayed(TICK_MS, ::tick)
        }
    }
}
