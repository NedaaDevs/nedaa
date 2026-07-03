package dev.nedaa.android.widgets.importantdays

import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Calendar

class ImportantDaysDataServiceTest {

    private fun isoOf(daysFromToday: Int, now: Long): String {
        val cal = Calendar.getInstance().apply {
            timeInMillis = now
            add(Calendar.DAY_OF_YEAR, daysFromToday)
        }
        val year = cal.get(Calendar.YEAR)
        val month = cal.get(Calendar.MONTH) + 1
        val day = cal.get(Calendar.DAY_OF_MONTH)
        return "%04d-%02d-%02d".format(year, month, day)
    }

    private fun noonToday(): Long =
        Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 12)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis

    @Test
    fun `future date counts whole days ahead`() {
        val now = noonToday()
        val dateISO = isoOf(10, now)
        assertEquals(10, ImportantDaysDataService.daysUntil(dateISO, now))
    }

    @Test
    fun `today's date returns zero`() {
        val now = noonToday()
        val dateISO = isoOf(0, now)
        assertEquals(0, ImportantDaysDataService.daysUntil(dateISO, now))
    }

    @Test
    fun `past date is coerced to zero, never negative`() {
        val now = noonToday()
        val dateISO = isoOf(-5, now)
        assertEquals(0, ImportantDaysDataService.daysUntil(dateISO, now))
    }
}
