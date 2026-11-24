package expo.modules.alarm

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

// The emergency quiet's rules; utils/emergencyQuiet.ts is the JS twin.
object EmergencyQuiet {

    const val MINUTES = 5
    const val MS = MINUTES * 60_000L
    const val CONFIRM_WAIT_SECONDS = 2

    const val ALLOWANCE_OFF = 0
    const val ALLOWANCE_ONE = 1
    const val DEFAULT_ALLOWANCE = 2
    const val ALLOWANCE_THREE = 3
    val ALLOWANCES = listOf(ALLOWANCE_OFF, ALLOWANCE_ONE, DEFAULT_ALLOWANCE, ALLOWANCE_THREE)

    private const val MONTHS_PER_YEAR = 12
    private const val QUIET_SUFFIX = "_quiet"
    private const val ISO_UTC = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"

    data class Raise(val to: Int, val from: Int)

    // `month` is year * 12 + month index in device local time, as MonthKey.
    data class Ledger(
        val allowance: Int,
        val raise: Raise?,
        val month: Int?,
        val used: Int,
        val lastWriteAt: Long?,
    )

    val NEW_LEDGER = Ledger(DEFAULT_ALLOWANCE, null, null, 0, null)

    fun monthKeyOf(now: Long): Int {
        val date = Calendar.getInstance().apply { timeInMillis = now }
        return date.get(Calendar.YEAR) * MONTHS_PER_YEAR + date.get(Calendar.MONTH)
    }

    // Local midnight on the month's first day.
    fun firstDayOf(month: Int): Long = Calendar.getInstance().apply {
        clear()
        set(Math.floorDiv(month, MONTHS_PER_YEAR), Math.floorMod(month, MONTHS_PER_YEAR), 1)
    }.timeInMillis

    private fun wentBack(ledger: Ledger, now: Long): Boolean =
        ledger.lastWriteAt != null && now < ledger.lastWriteAt

    // A clock set back keeps the count in the clock's month: no refill, no wait.
    private fun rollTo(ledger: Ledger, now: Long): Ledger {
        val back = wentBack(ledger, now)
        val month = if (back) monthKeyOf(now) else maxOf(monthKeyOf(now), ledger.month ?: Int.MIN_VALUE)
        val raise = if (back && ledger.raise != null) {
            ledger.raise.copy(from = minOf(ledger.raise.from, month + 1))
        } else {
            ledger.raise
        }
        val raised = raise?.takeIf { month >= it.from }
        return Ledger(
            allowance = raised?.to ?: ledger.allowance,
            raise = if (raised != null) null else raise,
            month = month,
            used = if (back || month == ledger.month) ledger.used else 0,
            lastWriteAt = now,
        )
    }

    fun settleClock(ledger: Ledger, now: Long): Ledger =
        if (wentBack(ledger, now)) rollTo(ledger, now) else ledger

    fun allowanceInEffect(ledger: Ledger, now: Long): Int = rollTo(ledger, now).allowance

    fun usesLeft(ledger: Ledger, now: Long): Int {
        val rolled = rollTo(ledger, now)
        return maxOf(0, rolled.allowance - rolled.used)
    }

    // Null when none is left.
    fun recordUse(ledger: Ledger, now: Long): Ledger? {
        val rolled = rollTo(ledger, now)
        if (rolled.used >= rolled.allowance) return null
        return rolled.copy(used = rolled.used + 1)
    }

    // A lower or equal allowance applies at once; a higher one next month.
    fun setAllowance(ledger: Ledger, allowance: Int, now: Long): Ledger {
        require(allowance in ALLOWANCES) { "no allowance $allowance" }
        val rolled = rollTo(ledger, now)
        if (allowance <= rolled.allowance) return rolled.copy(allowance = allowance, raise = null)
        return rolled.copy(raise = Raise(allowance, rolled.month!! + 1))
    }

    fun refillDate(ledger: Ledger, now: Long): Long = firstDayOf(rollTo(ledger, now).month!! + 1)

    // A ledger the app wrote stands; else the app's saved ledger replaces the row.
    fun seedFrom(app: Ledger, appWritten: Ledger?, now: Long): Ledger = settleClock(appWritten ?: app, now)

    enum class Offer(val id: String) {
        HIDDEN("hidden"),
        OFFER("offer"),
        NONE_LEFT("noneLeft"),
        USED("used"),
        ON("on"),
    }

    data class OfferInput(
        val hasTask: Boolean,
        val preview: Boolean,
        val snoozed: Boolean,
        // "Stop alarm" has appeared in the open task run.
        val wayOut: Boolean,
        // This alarm, snoozes included, has had its quiet.
        val used: Boolean,
        val quietUntil: Long?,
        val allowance: Int,
        val left: Int,
    )

    fun offerFor(input: OfferInput): Offer = when {
        input.quietUntil != null -> Offer.ON
        !input.hasTask || input.preview || input.snoozed || input.wayOut -> Offer.HIDDEN
        input.used -> Offer.USED
        input.allowance == ALLOWANCE_OFF -> Offer.HIDDEN
        input.left > 0 -> Offer.OFFER
        else -> Offer.NONE_LEFT
    }

    fun confirmOpen(confirming: Boolean, offer: Offer): Boolean = confirming && offer == Offer.OFFER

    // A running quiet holds the snooze.
    fun canSnooze(snoozeOpen: Boolean, quietUntil: Long?): Boolean = snoozeOpen && quietUntil == null

    // A shown overlay takes only its running quiet's re-ring.
    fun reachesOverlay(overlayShown: Boolean, quietRingId: String?, alarmId: String): Boolean =
        !overlayShown || alarmId == quietRingId

    fun quietEndsAt(now: Long): Long = now + MS

    // As JS Date.toISOString.
    fun isoUtc(at: Long): String = SimpleDateFormat(ISO_UTC, Locale.US)
        .apply { timeZone = TimeZone.getTimeZone("UTC") }
        .format(at)

    fun alarmKey(type: String, triggerAt: Long): String = "${type}_${isoUtc(triggerAt)}"

    fun quietKey(type: String, ringsAt: Long): String = alarmKey(type, ringsAt) + QUIET_SUFFIX

    fun quietIdFor(type: String, ringsAt: Long): String = deterministicUuid(quietKey(type, ringsAt))

    // Only a quiet makes a quiet key's id; a later snooze has a snooze id.
    fun runningQuietEnd(id: String, type: String, triggerAt: Long, quietUsed: Boolean, now: Long): Long? =
        if (quietUsed && triggerAt > now && id == quietIdFor(type, triggerAt)) triggerAt else null

    // As JS generateDeterministicUUID: two Int-wrapping hashes over UTF-16 units.
    fun deterministicUuid(input: String): String {
        var hash1 = 0
        var hash2 = 0
        for (char in input) {
            hash1 = (hash1 shl 5) - hash1 + char.code
            hash2 = (hash2 shl 7) + hash2 + char.code
        }
        val hex1 = hex(hash1)
        val hex2 = hex(hash2)
        val hex3 = hex(hash1 xor hash2)
        val hex4 = hex(hash1 + hash2)
        return listOf(
            hex1,
            hex2.substring(0, 4),
            "4" + hex2.substring(5, 8),
            "8" + hex3.substring(1, 4),
            hex3.substring(4, 8) + hex4,
        ).joinToString("-")
    }

    private fun hex(value: Int): String = Integer.toHexString(value).padStart(8, '0')
}
