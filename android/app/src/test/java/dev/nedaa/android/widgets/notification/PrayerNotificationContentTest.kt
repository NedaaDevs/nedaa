package dev.nedaa.android.widgets.notification

import dev.nedaa.android.widgets.data.DayPrayers
import dev.nedaa.android.widgets.data.PrayerData
import dev.nedaa.android.widgets.prayer.isNextPrayer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Date

class PrayerNotificationContentTest {

    @Test
    fun `expanded content matches the selected prayer by name and time`() {
        val next = PrayerData(PrayerData.ASR, Date(2_000L))

        assertTrue(isNextPrayer(next, PrayerData(PrayerData.ASR, Date(2_000L))))
    }

    @Test
    fun `after Isha both states use tomorrow and highlight Fajr`() {
        val now = System.currentTimeMillis()
        val today = DayPrayers(
            date = 20260828,
            timezone = "UTC",
            prayers = listOf(PrayerData(PrayerData.ISHA, Date(now - 1_000L)))
        )
        val tomorrow = DayPrayers(
            date = 20260829,
            timezone = "UTC",
            prayers = listOf(PrayerData(PrayerData.FAJR, Date(now + 1_000L)))
        )
        val next = tomorrow.prayers.single()

        assertEquals(tomorrow, PrayerNotificationPublisher.selectDay(today, tomorrow))
        assertTrue(isNextPrayer(tomorrow.prayers.single(), next))
    }
}
