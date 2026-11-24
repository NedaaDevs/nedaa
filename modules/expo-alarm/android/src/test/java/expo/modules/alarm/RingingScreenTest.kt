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
    fun everySnoozePlaceMatchesJs() {
        val rows = sharedTable("snooze-place.tsv")
        check(rows.isNotEmpty())
        for (row in rows) {
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
}
