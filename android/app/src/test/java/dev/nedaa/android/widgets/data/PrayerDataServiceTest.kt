package dev.nedaa.android.widgets.data

import dev.nedaa.android.widgets.common.SnapshotDay
import dev.nedaa.android.widgets.common.SnapshotPrayerTimes
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PrayerDataServiceTest {

    private val timings = JSONObject(
        """{ "fajr": "2026-09-06T04:30:00+03:00", "dhuhr": "2026-09-06T12:05:00+03:00",
             "asr": "2026-09-06T15:30:00+03:00", "maghrib": "2026-09-06T18:10:00+03:00",
             "isha": "2026-09-06T19:40:00+03:00" }"""
    )
    private val other = JSONObject("""{ "sunrise": "2026-09-06T05:50:00+03:00" }""")
    private val snapshot = SnapshotPrayerTimes(
        timezone = "Asia/Riyadh",
        days = listOf(SnapshotDay(20260906, timings, other), SnapshotDay(20260907, timings, other)),
    )

    @Test
    fun `builds the day's prayers in time order, with sunrise when asked`() {
        val day = PrayerDataService.dayFrom(snapshot, 20260906, showSunrise = true, timezone = "Asia/Riyadh")!!
        assertEquals(20260906, day.date)
        assertEquals("Asia/Riyadh", day.timezone)
        assertEquals(
            listOf(PrayerData.FAJR, PrayerData.SUNRISE, PrayerData.DHUHR, PrayerData.ASR, PrayerData.MAGHRIB, PrayerData.ISHA),
            day.prayers.map { it.name },
        )
    }

    @Test
    fun `leaves sunrise out when not asked`() {
        val day = PrayerDataService.dayFrom(snapshot, 20260906, showSunrise = false, timezone = "Asia/Riyadh")!!
        assertEquals(5, day.prayers.size)
    }

    @Test
    fun `a Friday is Jumuah`() {
        // 2026-09-11 is a Friday.
        val friday = JSONObject(timings.toString().replace("2026-09-06", "2026-09-11"))
        val s = SnapshotPrayerTimes("Asia/Riyadh", listOf(SnapshotDay(20260911, friday, JSONObject())))
        val day = PrayerDataService.dayFrom(s, 20260911, showSunrise = false, timezone = "Asia/Riyadh")!!
        assertEquals(PrayerData.JUMUAH, day.prayers[1].name)
    }

    @Test
    fun `a date the snapshot lacks is null`() {
        assertNull(PrayerDataService.dayFrom(snapshot, 20260909, showSunrise = true, timezone = "Asia/Riyadh"))
        assertNull(PrayerDataService.dayFrom(null, 20260906, showSunrise = true, timezone = "Asia/Riyadh"))
    }
}
