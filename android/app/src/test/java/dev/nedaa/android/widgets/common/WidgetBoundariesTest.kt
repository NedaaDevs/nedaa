package dev.nedaa.android.widgets.common

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Calendar
import java.util.TimeZone

class WidgetBoundariesTest {
    private val now = 1_000_000_000_000L

    @Test
    fun `picks the earliest future candidate`() {
        val next = WidgetBoundaries.nextBoundary(now, listOf(now + 7_200_000, now + 3_600_000, null))
        assertEquals(now + 3_600_000, next)
    }

    @Test
    fun `skips candidates in the past or within the minimum lead`() {
        val next = WidgetBoundaries.nextBoundary(now, listOf(now - 1, now + 30_000, now + 600_000))
        assertEquals(now + 600_000, next)
    }

    @Test
    fun `falls back to fifteen minutes when nothing is upcoming`() {
        assertEquals(now + 15 * 60_000, WidgetBoundaries.nextBoundary(now, listOf(null, now - 5)))
    }

    @Test
    fun `nextMidnight lands at midnight of the following day in the zone`() {
        val tz = TimeZone.getTimeZone("Asia/Riyadh")
        val midnight = WidgetBoundaries.nextMidnight(now, tz)
        val cal = Calendar.getInstance(tz).apply { timeInMillis = midnight }
        assertEquals(0, cal.get(Calendar.HOUR_OF_DAY))
        assertEquals(0, cal.get(Calendar.MINUTE))
        assertTrue(midnight > now)
    }
}
