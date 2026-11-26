package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

// The ringing-header, snooze-place and solved-exit tables,
// which wakeTasksNative.test.ts runs against the JS rules.
class RingingScreenTest {

    private fun yes(cell: String): Boolean = cell == FIXTURE_YES

    private fun cell(value: String): String = if (value == FIXTURE_NONE) "" else value

    @Test
    fun everyHeaderMatchesJs() {
        val rows = sharedTable("ringing-header.tsv")
        check(rows.isNotEmpty())
        for (row in rows) {
            check(row.size == 8) { "ringing-header row: $row" }
            val (type, hasMoment) = row
            val header = RingingScreen.header(RingingScreen.typeOf(cell(type)), yes(hasMoment))
            val shown = listOf(
                header.prayer?.key ?: FIXTURE_NONE,
                header.alarm.key,
                header.name.key,
                header.time.key,
                header.heading.key,
                header.announcement.key,
            )
            assertEquals("$type with moment $hasMoment", row.subList(2, 8), shown)
        }
    }

    @Test
    fun aStoredMomentKeepsItsInstantAndZone() {
        assertEquals(RingingScreen.Moment(MOMENT_AT, ZONE), RingingScreen.momentOf(MOMENT_AT, ZONE))
    }

    // An old row has neither; a zone this device cannot read would show a wrong hour.
    @Test
    fun aMissingPartOrAnUnknownZoneStoresNoMoment() {
        assertEquals(null, RingingScreen.momentOf(null, ZONE))
        assertEquals(null, RingingScreen.momentOf(MOMENT_AT, null))
        assertEquals(null, RingingScreen.momentOf(MOMENT_AT, "Mars/Olympus"))
    }

    // The prayer's hour in its own place, wherever the phone is.
    @Test
    fun aMomentReadsInItsOwnZone() {
        val calendar = RingingScreen.Moment(MOMENT_AT, ZONE).calendar()
        assertEquals(4, calendar.get(java.util.Calendar.HOUR_OF_DAY))
        assertEquals(30, calendar.get(java.util.Calendar.MINUTE))
    }

    @Test
    fun everySnoozePlaceMatchesJs() {
        val rows = sharedTable("snooze-place.tsv")
        check(rows.isNotEmpty())
        for (row in rows) {
            check(row.size == 6) { "snooze-place row: $row" }
            val (enabled, count, max, can, left) = row
            val use = RingingScreen.SnoozeUse(yes(enabled), count.toInt(), max.toInt())
            val open = RingingScreen.snoozeOpen(use)
            val shown = listOf(open, RingingScreen.snoozeLeft(use), RingingScreen.snoozePlace(open, use.enabled).key)
            assertEquals(row.joinToString(), listOf(yes(can), left.toInt(), row[5]), shown)
        }
    }

    @Test
    fun everySolvedExitMatchesJs() {
        val rows = sharedTable("solved-exit.tsv")
        check(rows.isNotEmpty())
        for ((stack, panel) in rows) {
            val tasks = WakeTasks.normalize(WakeTasks.decode(cell(stack)))
            assertEquals(stack, yes(panel), RingingScreen.solvedShowsPanel(tasks))
        }
    }

    private companion object {
        // 2026-09-26 01:30 UTC: 04:30 in Riyadh.
        const val MOMENT_AT = 1_790_386_200_000L
        const val ZONE = "Asia/Riyadh"
    }
}
