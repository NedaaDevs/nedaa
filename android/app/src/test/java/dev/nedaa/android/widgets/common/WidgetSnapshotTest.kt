package dev.nedaa.android.widgets.common

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.TimeZone

class WidgetSnapshotTest {

    private val full = """
        {
          "version": 1,
          "writtenAt": 1788700633236,
          "config": { "useWesternNumerals": true, "timezone": "Asia/Riyadh", "hijriDaysOffset": -1 },
          "prayerTimes": {
            "timezone": "Asia/Riyadh",
            "days": [
              { "date": 20260906, "timings": { "fajr": "2026-09-06T04:30:00+03:00" }, "otherTimings": { "sunrise": "2026-09-06T05:50:00+03:00" } },
              { "date": 20260907, "timings": { "fajr": "2026-09-07T04:31:00+03:00" }, "otherTimings": {} }
            ]
          },
          "hijriToday": { "date": 20260906, "hijriLabel": "14 Rabi I 1448" },
          "importantDays": [ { "id": "eid", "name": "Eid", "hijriLabel": "1 Shawwal", "dateISO": "2026-09-20" } ],
          "athkar": {
            "date": 20260906,
            "morning": { "completed": 22, "total": 22, "completedAt": "2026-09-06T04:10:00.000Z" },
            "evening": { "completed": 0, "total": 22, "completedAt": null },
            "streak": { "current": 5, "longest": 12 }
          },
          "qada": { "date": 20260906, "totalMissed": 30, "totalCompleted": 12, "completedToday": 1 }
        }
    """.trimIndent()

    @Test
    fun `parses every group of a full document`() {
        val s = WidgetSnapshot.parse(full)
        assertNotNull(s)
        s!!
        assertEquals(1788700633236L, s.writtenAt)
        assertEquals(SnapshotConfig(true, "Asia/Riyadh", -1), s.config)
        assertEquals("Asia/Riyadh", s.prayerTimes!!.timezone)
        assertEquals(listOf(20260906, 20260907), s.prayerTimes!!.days.map { it.date })
        assertEquals("2026-09-06T04:30:00+03:00", s.prayerTimes!!.days[0].timings.getString("fajr"))
        assertEquals(SnapshotHijriToday(20260906, "14 Rabi I 1448"), s.hijriToday)
        assertEquals(listOf(SnapshotImportantDay("eid", "Eid", "1 Shawwal", "2026-09-20")), s.importantDays)
        assertEquals(SnapshotSession(22, 22, "2026-09-06T04:10:00.000Z"), s.athkar!!.morning)
        assertEquals(SnapshotSession(0, 22, null), s.athkar!!.evening)
        assertEquals(SnapshotStreak(5, 12), s.athkar!!.streak)
        assertEquals(SnapshotQada(20260906, 30, 12, 1), s.qada)
    }

    @Test
    fun `a JSON null completedAt reads as Kotlin null, not the string "null"`() {
        val s = WidgetSnapshot.parse(full)!!
        assertNull(s.athkar!!.evening.completedAt)
    }

    @Test
    fun `an unknown version is no snapshot`() {
        assertNull(WidgetSnapshot.parse("""{ "version": 2, "config": {} }"""))
        assertNull(WidgetSnapshot.parse("""{ "config": {} }"""))
    }

    @Test
    fun `torn or empty input is no snapshot`() {
        assertNull(WidgetSnapshot.parse(""))
        assertNull(WidgetSnapshot.parse("""{ "version": 1, "config": { "timez"""))
        assertNull(WidgetSnapshot.parse("not json"))
    }

    @Test
    fun `a missing group is null while the others parse`() {
        val s = WidgetSnapshot.parse("""{ "version": 1, "qada": { "date": 20260906, "totalMissed": 1, "totalCompleted": 0, "completedToday": 0 } }""")
        assertNotNull(s)
        assertNull(s!!.config)
        assertNull(s.prayerTimes)
        assertNull(s.hijriToday)
        assertNull(s.importantDays)
        assertNull(s.athkar)
        assertEquals(SnapshotQada(20260906, 1, 0, 0), s.qada)
    }

    @Test
    fun `a day without timings is dropped rather than parsed as empty`() {
        val s = WidgetSnapshot.parse("""{ "version": 1, "prayerTimes": { "timezone": "UTC", "days": [ { "date": 20260906 }, { "date": 20260907, "timings": {} } ] } }""")
        assertEquals(listOf(20260907), s!!.prayerTimes!!.days.map { it.date })
    }

    @Test
    fun `dateIntFor keys the day off the zone`() {
        // 2026-09-05T22:30Z is 01:30 on the 6th in Riyadh and still the 5th in UTC.
        val t = 1788647400000L
        assertEquals(20260906, WidgetSnapshot.dateIntFor(t, TimeZone.getTimeZone("Asia/Riyadh")))
        assertEquals(20260905, WidgetSnapshot.dateIntFor(t, TimeZone.getTimeZone("UTC")))
    }
}
