package dev.nedaa.android.widgets.common

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Calendar
import java.util.TimeZone

class DayWindowTest {
    private fun at(zone: String, y: Int, m: Int, d: Int, h: Int = 12): Long =
        Calendar.getInstance(TimeZone.getTimeZone(zone)).apply {
            clear()
            set(y, m - 1, d, h, 0, 0)
        }.timeInMillis

    @Test
    fun `renders an instant in utc, matching toISOString`() {
        // 2026-08-26T00:00:00Z exactly.
        assertEquals("2026-08-26T00:00:00.000Z", DayWindow.toUtcIso(1_787_702_400_000L))
    }

    @Test
    fun `keeps milliseconds, which the comparison is lexical over`() {
        assertEquals("2026-08-26T00:00:00.123Z", DayWindow.toUtcIso(1_787_702_400_123L))
    }

    @Test
    fun `bounds are the utc rendering of local midnight, not local fields stamped with Z`() {
        // Riyadh is UTC+3 year-round, so its midnight is 21:00Z the day before. The old
        // implementation emitted "2026-08-26T00:00:00.000Z" here and counted the wrong day.
        val (start, end) = DayWindow.todayUtcBounds(TimeZone.getTimeZone("Asia/Riyadh"), at("Asia/Riyadh", 2026, 8, 26))
        assertEquals("2026-08-25T21:00:00.000Z", start)
        assertEquals("2026-08-26T21:00:00.000Z", end)
    }

    @Test
    fun `bounds match local fields only when the device is on utc`() {
        val (start, end) = DayWindow.todayUtcBounds(TimeZone.getTimeZone("UTC"), at("UTC", 2026, 8, 26))
        assertEquals("2026-08-26T00:00:00.000Z", start)
        assertEquals("2026-08-27T00:00:00.000Z", end)
    }

    @Test
    fun `handles a zone behind utc`() {
        val (start, _) = DayWindow.todayUtcBounds(
            TimeZone.getTimeZone("America/New_York"),
            at("America/New_York", 2026, 8, 26)
        )
        assertEquals("2026-08-26T04:00:00.000Z", start)
    }

    @Test
    fun `spring-forward day is 23 hours, and the window still ends at local midnight`() {
        // US DST begins 2026-03-08; that local day is 23 hours long.
        val zone = TimeZone.getTimeZone("America/New_York")
        val now = at("America/New_York", 2026, 3, 8)
        val span = DayWindow.localDayEnd(zone, now) - DayWindow.localDayStart(zone, now)
        assertEquals(23 * 3_600_000L, span)

        val midnight = Calendar.getInstance(zone).apply {
            timeInMillis = DayWindow.localDayEnd(zone, now)
        }
        assertEquals(0, midnight.get(Calendar.HOUR_OF_DAY))
    }

    @Test
    fun `fall-back day is 25 hours, and the window still ends at local midnight`() {
        // US DST ends 2026-11-01; that local day is 25 hours long.
        val zone = TimeZone.getTimeZone("America/New_York")
        val now = at("America/New_York", 2026, 11, 1)
        val span = DayWindow.localDayEnd(zone, now) - DayWindow.localDayStart(zone, now)
        assertEquals(25 * 3_600_000L, span)

        val midnight = Calendar.getInstance(zone).apply {
            timeInMillis = DayWindow.localDayEnd(zone, now)
        }
        assertEquals(0, midnight.get(Calendar.HOUR_OF_DAY))
    }

    @Test
    fun `an instant inside the day falls within its own bounds`() {
        val zone = TimeZone.getTimeZone("Asia/Riyadh")
        val now = at("Asia/Riyadh", 2026, 8, 26, h = 23)
        val (start, end) = DayWindow.todayUtcBounds(zone, now)
        val stamp = DayWindow.toUtcIso(now)
        // The query compares these as strings, so the ordering must hold lexically.
        assertTrue("$start <= $stamp", start <= stamp)
        assertTrue("$stamp < $end", stamp < end)
    }

    @Test
    fun `the first instant of the day is included and the last is excluded`() {
        val zone = TimeZone.getTimeZone("Asia/Riyadh")
        val now = at("Asia/Riyadh", 2026, 8, 26)
        val (start, end) = DayWindow.todayUtcBounds(zone, now)
        assertEquals(start, DayWindow.toUtcIso(DayWindow.localDayStart(zone, now)))
        assertEquals(end, DayWindow.toUtcIso(DayWindow.localDayEnd(zone, now)))
    }
}
