package dev.nedaa.android.widgets.common

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/**
 * The current local day, expressed as the UTC instants that bound it.
 *
 * Rows written by the app stamp their timestamps with `new Date().toISOString()`, a true
 * UTC instant, and the widget queries compare those strings lexically. A bound must
 * therefore be the UTC rendering of local midnight: formatting local wall-clock fields and
 * appending `Z` would claim UTC while carrying local time, shifting the window by the
 * device's offset.
 *
 * Zone and clock are parameters rather than ambient state so the behaviour is testable.
 */
object DayWindow {
    private const val ISO_UTC = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"

    /** Renders an instant the way `Date.prototype.toISOString()` does. */
    fun toUtcIso(millis: Long): String =
        SimpleDateFormat(ISO_UTC, Locale.US)
            .apply { timeZone = TimeZone.getTimeZone("UTC") }
            .format(millis)

    /** Midnight that opened the local day containing [nowMillis]. */
    fun localDayStart(zone: TimeZone, nowMillis: Long): Long =
        Calendar.getInstance(zone).apply {
            timeInMillis = nowMillis
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis

    /**
     * The next local midnight. Derived by adding a calendar day rather than 24 hours, so a
     * DST transition inside the day does not move the boundary off midnight.
     */
    fun localDayEnd(zone: TimeZone, nowMillis: Long): Long =
        Calendar.getInstance(zone).apply {
            timeInMillis = localDayStart(zone, nowMillis)
            add(Calendar.DAY_OF_YEAR, 1)
        }.timeInMillis

    /** Half-open `[start, end)` bounds for the local day, as UTC ISO-8601 strings. */
    fun todayUtcBounds(zone: TimeZone, nowMillis: Long): Pair<String, String> =
        toUtcIso(localDayStart(zone, nowMillis)) to toUtcIso(localDayEnd(zone, nowMillis))
}
