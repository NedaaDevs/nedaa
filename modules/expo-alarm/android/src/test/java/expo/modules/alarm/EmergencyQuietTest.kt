package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

// The quiet-ledger, quiet-offer, quiet-run and quiet-id tables,
// which emergencyQuietNative.test.ts runs against the JS rules.
class EmergencyQuietTest {

    private object QuietCell {
        const val NO = "no"
        const val RAISE = '@'
        const val SET = "set="
        const val DATE = '-'
        const val TIME = 'T'
        const val CLOCK = ':'
    }

    private object QuietOp {
        const val LOOK = "look"
        const val USE = "use"
    }

    private object IdKind {
        const val QUIET = "quiet"
    }

    private fun yes(cell: String): Boolean = cell == FIXTURE_YES

    private fun flag(value: Boolean): String = if (value) FIXTURE_YES else QuietCell.NO

    private fun pad(value: Int): String = value.toString().padStart(2, '0')

    private fun monthOf(cell: String): Int? {
        if (cell == FIXTURE_NONE) return null
        val (year, month) = cell.split(QuietCell.DATE).map { it.toInt() }
        return year * MONTHS_PER_YEAR + month - 1
    }

    private fun shownMonth(month: Int?): String =
        if (month == null) FIXTURE_NONE else "${month / MONTHS_PER_YEAR}${QuietCell.DATE}${pad(month % MONTHS_PER_YEAR + 1)}"

    // Device local time, so the table holds in every time zone.
    private fun timeOf(cell: String): Long? {
        if (cell == FIXTURE_NONE) return null
        val (day, clock) = cell.split(QuietCell.TIME)
        val (year, month, date) = day.split(QuietCell.DATE).map { it.toInt() }
        val (hours, minutes) = clock.split(QuietCell.CLOCK).map { it.toInt() }
        return Calendar.getInstance().apply {
            clear()
            set(year, month - 1, date, hours, minutes)
        }.timeInMillis
    }

    private fun calendarAt(at: Long): Calendar = Calendar.getInstance().apply { timeInMillis = at }

    private fun shownDay(at: Long?): String {
        if (at == null) return FIXTURE_NONE
        val date = calendarAt(at)
        return listOf(date.get(Calendar.YEAR).toString(), pad(date.get(Calendar.MONTH) + 1), pad(date.get(Calendar.DAY_OF_MONTH)))
            .joinToString(QuietCell.DATE.toString())
    }

    private fun shownTime(at: Long?): String {
        if (at == null) return FIXTURE_NONE
        val date = calendarAt(at)
        return "${shownDay(at)}${QuietCell.TIME}${pad(date.get(Calendar.HOUR_OF_DAY))}${QuietCell.CLOCK}${pad(date.get(Calendar.MINUTE))}"
    }

    private fun raiseOf(cell: String): EmergencyQuiet.Raise? {
        if (cell == FIXTURE_NONE) return null
        val (to, from) = cell.split(QuietCell.RAISE)
        return EmergencyQuiet.Raise(to.toInt(), checkNotNull(monthOf(from)))
    }

    private fun shownRaise(raise: EmergencyQuiet.Raise?): String =
        raise?.let { "${it.to}${QuietCell.RAISE}${shownMonth(it.from)}" } ?: FIXTURE_NONE

    private fun isoMillis(cell: String): Long = SimpleDateFormat(ISO_UTC, Locale.US)
        .apply { timeZone = TimeZone.getTimeZone("UTC") }
        .parse(cell)!!
        .time

    @Test
    fun everyLedgerRowMatchesJs() {
        val rows = sharedTable("quiet-ledger.tsv")
        check(rows.isNotEmpty())
        for (row in rows) {
            check(row.size == LEDGER_COLUMNS) { "quiet-ledger row: $row" }
            val ledger = EmergencyQuiet.Ledger(row[0].toInt(), raiseOf(row[1]), monthOf(row[2]), row[3].toInt(), timeOf(row[4]))
            val now = checkNotNull(timeOf(row[5]))
            val op = row[6]
            var counted = FIXTURE_NONE
            val after = when {
                op == QuietOp.LOOK -> EmergencyQuiet.settleClock(ledger, now)
                op == QuietOp.USE -> {
                    val spent = EmergencyQuiet.recordUse(ledger, now)
                    counted = flag(spent != null)
                    spent ?: ledger
                }
                else -> EmergencyQuiet.setAllowance(ledger, op.removePrefix(QuietCell.SET).toInt(), now)
            }
            val shown = listOf(
                counted,
                after.allowance.toString(),
                shownRaise(after.raise),
                shownMonth(after.month),
                after.used.toString(),
                shownTime(after.lastWriteAt),
                EmergencyQuiet.usesLeft(after, now).toString(),
                EmergencyQuiet.allowanceInEffect(after, now).toString(),
                shownDay(EmergencyQuiet.refillDate(after, now)),
            )
            // Native has no chosen-allowance or raise-start readers; JS checks those columns.
            val expected = row.subList(7, CHOSEN_COLUMN) + row[REFILL_COLUMN]
            assertEquals(row.joinToString(), expected, shown)
        }
    }

    // The table is local time, so it must hold in any zone.
    @Test
    fun theLedgerTableHoldsInEveryZone() {
        val home = TimeZone.getDefault()
        try {
            for (zone in listOf("Pacific/Kiritimati", "America/Los_Angeles", "Asia/Riyadh")) {
                TimeZone.setDefault(TimeZone.getTimeZone(zone))
                everyLedgerRowMatchesJs()
            }
        } finally {
            TimeZone.setDefault(home)
        }
    }

    @Test
    fun everyOfferRowMatchesJs() {
        val rows = sharedTable("quiet-offer.tsv")
        check(rows.isNotEmpty())
        for (row in rows) {
            check(row.size == OFFER_COLUMNS) { "quiet-offer row: $row" }
            val offer = EmergencyQuiet.offerFor(
                EmergencyQuiet.OfferInput(
                    hasTask = yes(row[0]),
                    preview = yes(row[1]),
                    snoozed = yes(row[2]),
                    wayOut = yes(row[3]),
                    used = yes(row[4]),
                    quietUntil = if (yes(row[5])) 1L else null,
                    allowance = row[6].toInt(),
                    left = row[7].toInt(),
                )
            )
            val shown = listOf(offer.id, flag(EmergencyQuiet.confirmOpen(yes(row[8]), offer)))
            assertEquals(row.joinToString(), listOf(row[9], flag(yes(row[10]))), shown)
        }
        assertEquals(EmergencyQuiet.Offer.entries.map { it.id }.toSet(), rows.map { it[9] }.toSet())
    }

    @Test
    fun everyQuietIdMatchesJs() {
        val rows = sharedTable("quiet-id.tsv")
        check(rows.isNotEmpty())
        for ((type, now, ringsAt, key, id) in rows) {
            val at = EmergencyQuiet.quietEndsAt(isoMillis(now))
            val shown = listOf(EmergencyQuiet.isoUtc(at), EmergencyQuiet.quietKey(type, at), EmergencyQuiet.quietIdFor(type, at))
            assertEquals("$type at $now", listOf(ringsAt, key, id), shown)
        }
    }

    @Test
    fun everyRunningQuietMatchesJs() {
        val rows = sharedTable("quiet-run.tsv")
        check(rows.isNotEmpty())
        for (row in rows) {
            check(row.size == RUN_COLUMNS) { "quiet-run row: $row" }
            val (type, trigger, kind, quietUsed, now) = row
            val at = isoMillis(trigger)
            val key = if (kind == IdKind.QUIET) EmergencyQuiet.quietKey(type, at) else EmergencyQuiet.alarmKey(type, at)
            val end = EmergencyQuiet.runningQuietEnd(EmergencyQuiet.deterministicUuid(key), type, at, yes(quietUsed), isoMillis(now))
            val shown = listOf(end?.let { EmergencyQuiet.isoUtc(it) } ?: FIXTURE_NONE, flag(EmergencyQuiet.canSnooze(yes(row[5]), end)))
            assertEquals(row.joinToString(), listOf(row[6], flag(yes(row[7]))), shown)
        }
    }

    @Test
    fun aSeedTakesTheAppsLedgerOverARowTheAppNeverWrote() {
        val now = checkNotNull(timeOf("2026-11-24T05:00"))
        val app = EmergencyQuiet.Ledger(3, null, monthOf("2026-11"), 1, timeOf("2026-11-20T05:00"))
        assertEquals(EmergencyQuiet.settleClock(app, now), EmergencyQuiet.seedFrom(app, null, now))
    }

    // The app's saved copy may be older than the overlay's count in the row.
    @Test
    fun aSeedKeepsARowTheAppWrote() {
        val now = checkNotNull(timeOf("2026-11-24T05:00"))
        val app = EmergencyQuiet.Ledger(1, null, monthOf("2026-11"), 0, timeOf("2026-11-20T05:00"))
        val written = EmergencyQuiet.Ledger(1, null, monthOf("2026-11"), 1, timeOf("2026-11-23T05:00"))
        val seeded = EmergencyQuiet.seedFrom(app, written, now)
        assertEquals(listOf(1, 0), listOf(seeded.used, EmergencyQuiet.usesLeft(seeded, now)))
    }

    @Test
    fun aRearmKeepsAReRingThatIsStillAhead() {
        val now = 1_000_000L
        val delay = AlarmScheduler.REARM_DELAY_MS
        assertEquals(now + EmergencyQuiet.MS, AlarmScheduler.rearmAt(now, delay, now + EmergencyQuiet.MS))
        assertEquals(now + delay, AlarmScheduler.rearmAt(now, delay, now - 1))
        assertEquals(now + delay, AlarmScheduler.rearmAt(now, delay, now + delay))
    }

    @Test
    fun aShownOverlayTakesOnlyItsQuietsReRing() {
        val ring = EmergencyQuiet.quietIdFor(RING_TYPE, 1_000L)
        assertEquals(true, EmergencyQuiet.reachesOverlay(overlayShown = false, quietRingId = null, alarmId = "a"))
        assertEquals(false, EmergencyQuiet.reachesOverlay(overlayShown = true, quietRingId = null, alarmId = "a"))
        assertEquals(false, EmergencyQuiet.reachesOverlay(overlayShown = true, quietRingId = ring, alarmId = "a"))
        assertEquals(true, EmergencyQuiet.reachesOverlay(overlayShown = true, quietRingId = ring, alarmId = ring))
    }

    @Test
    fun anAllowanceOutsideTheChoicesIsRefused() {
        val refused = runCatching { EmergencyQuiet.setAllowance(EmergencyQuiet.NEW_LEDGER, ALLOWANCE_UNKNOWN, 0L) }
        assertEquals(true, refused.exceptionOrNull() is IllegalArgumentException)
    }

    private companion object {
        const val MONTHS_PER_YEAR = 12
        const val ISO_UTC = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
        const val LEDGER_COLUMNS = 18
        const val CHOSEN_COLUMN = 15
        const val REFILL_COLUMN = 16
        const val OFFER_COLUMNS = 11
        const val RUN_COLUMNS = 8
        const val ALLOWANCE_UNKNOWN = 4
        const val RING_TYPE = "fajr"
    }
}
