package expo.modules.alarm

// The task's quiet time and the sound counted while it is open, in epoch
// ms, as src/utils/taskClock.ts keeps them. task-clock.tsv pins the two.
data class TaskClock(
    // When the current quiet time ends.
    val quietUntil: Long,
    // The current quiet time's full length.
    val quietMs: Long,
    // Time the alarm has sounded while the task was open.
    val soundingMs: Long,
    // The moment sounding time is counted up to.
    val countedTo: Long,
) {
    enum class QuietPhase { PAUSED, ENDING, SOUNDING }

    // Counts sound to `now` only after a read that found quiet over, a short
    // stretch per read at most, and none while the alarm is unheard.
    fun advance(now: Long, audible: Boolean): TaskClock {
        if (now <= countedTo) return this
        val sounding = audible && countedTo >= quietUntil
        val gained = if (sounding) minOf(now - countedTo, MAX_GAIN_MS) else 0
        return copy(soundingMs = soundingMs + gained, countedTo = now)
    }

    // A full quiet time from `now`, once the time before it is counted.
    fun restartQuiet(now: Long, quietMs: Long, audible: Boolean): TaskClock =
        advance(now, audible).copy(quietUntil = now + quietMs, quietMs = quietMs)

    // Ends quiet time at `now`, once the time before it is counted.
    fun endQuiet(now: Long, audible: Boolean): TaskClock {
        val counted = advance(now, audible)
        return counted.copy(quietUntil = minOf(counted.quietUntil, now))
    }

    // A saved clock reopened at `now`; its closed time counts for nothing.
    fun resume(now: Long): TaskClock = copy(countedTo = maxOf(countedTo, now))

    fun quietPhase(now: Long): QuietPhase {
        val left = quietLeftMs(now)
        return when {
            left == 0L -> QuietPhase.SOUNDING
            left <= QUIET_ENDING_SECONDS * SECOND_MS -> QuietPhase.ENDING
            else -> QuietPhase.PAUSED
        }
    }

    fun quietSecondsLeft(now: Long): Long = ceilDiv(quietLeftMs(now), SECOND_MS)

    // How full the quiet bar is, 0 to 1; `stepped` holds it between steps.
    fun quietFraction(now: Long, stepped: Boolean): Double {
        val step = QUIET_BAR_STEP_SECONDS * SECOND_MS
        val left = quietLeftMs(now)
        val shown = if (stepped) ceilDiv(left, step) * step else left
        return minOf(1.0, shown.toDouble() / quietMs)
    }

    // "Stop alarm" shows after this much sound with the task open.
    val wayOutShown: Boolean
        get() = soundingMs >= WAY_OUT_SOUNDING_SECONDS * SECOND_MS

    private fun quietLeftMs(now: Long): Long = maxOf(0, quietUntil - now)

    companion object {
        // How long sound and vibration pause as a task opens or after a solve.
        const val QUIET_SECONDS = 30L
        const val QUIET_SECONDS_SCREEN_READER = 60L

        // The last stretch of quiet time, warned once before the sound returns.
        const val QUIET_ENDING_SECONDS = 5L

        // Sounding time, across the whole stack, before "Stop alarm" appears.
        const val WAY_OUT_SOUNDING_SECONDS = 120L

        // How often the clock is read, and the most sound one read adds.
        const val TICK_MS = 250L
        const val MAX_GAIN_MS = 2 * TICK_MS

        // The quiet bar's step under Reduce Motion, in seconds.
        const val QUIET_BAR_STEP_SECONDS = 5L

        private const val SECOND_MS = 1000L

        // Each quiet time's length; a screen reader gets the longer one.
        fun quietSecondsFor(screenReader: Boolean): Long =
            if (screenReader) QUIET_SECONDS_SCREEN_READER else QUIET_SECONDS

        // A clock whose quiet time starts as the task opens.
        fun start(now: Long, quietMs: Long): TaskClock =
            TaskClock(quietUntil = now + quietMs, quietMs = quietMs, soundingMs = 0, countedTo = now)

        private fun ceilDiv(value: Long, by: Long): Long = (value + by - 1) / by
    }
}
