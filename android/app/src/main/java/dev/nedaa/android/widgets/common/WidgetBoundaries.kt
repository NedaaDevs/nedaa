package dev.nedaa.android.widgets.common

import java.util.Calendar
import java.util.TimeZone

/**
 * Boundary math for widget update chaining. Pure JVM so it is unit-testable.
 */
object WidgetBoundaries {
    const val MIN_LEAD_MS = 60_000L
    const val FALLBACK_MS = 15 * 60_000L

    /** Earliest candidate further than MIN_LEAD from now; FALLBACK when none. */
    fun nextBoundary(now: Long, candidates: List<Long?>): Long =
        candidates.filterNotNull().filter { it > now + MIN_LEAD_MS }.minOrNull()
            ?: (now + FALLBACK_MS)

    /** Start of the next day in the given zone. */
    fun nextMidnight(now: Long, tz: TimeZone): Long =
        Calendar.getInstance(tz).apply {
            timeInMillis = now
            add(Calendar.DAY_OF_YEAR, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
}
