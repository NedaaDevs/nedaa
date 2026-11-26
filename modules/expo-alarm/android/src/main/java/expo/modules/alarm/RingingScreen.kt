package expo.modules.alarm

import java.util.Calendar
import java.util.TimeZone

// The ringing screen's rules, as JS alarmRinging.ts; each key is the JS value.
object RingingScreen {

    enum class Type(val id: String) { FAJR("fajr"), JUMMAH("jummah"), CUSTOM("custom") }

    // What heads the screen: a prayer's name, or an alarm's own.
    sealed interface Name { val key: String }

    enum class Prayer(override val key: String) : Name {
        FAJR("prayerTimes.fajr"),
        JUMUAH("prayerTimes.jumuah"),
    }

    enum class AlarmName(override val key: String) : Name {
        FAJR("alarm.types.fajr"),
        FRIDAY("alarm.types.friday"),
        CUSTOM("alarm.types.custom"),
    }

    enum class Time(val key: String) { PRAYER("prayer"), CLOCK("clock") }

    enum class Heading(val key: String) {
        CURRENT_TIME("a11y.alarm.currentTime"),
        RINGING_AT("a11y.alarm.ringingAt"),
    }

    enum class Announcement(val key: String) {
        PRAYER("a11y.alarm.ringingAnnouncement"),
        CUSTOM("a11y.alarm.ringingCustom"),
    }

    enum class SnoozePlace(val key: String) {
        BUTTON("button"),
        USED_UP("alarm.ringing.snoozeUsedUp"),
        OFF("alarm.ringing.snoozeOff"),
    }

    data class Header(
        val prayer: Prayer?,
        val alarm: AlarmName,
        val time: Time,
        val heading: Heading,
        val announcement: Announcement,
    ) {
        // The prayer's name heads the screen; a custom alarm shows its own.
        val name: Name get() = prayer ?: alarm
    }

    // A prayer's moment and the zone its clock is read in, as JS PrayerMoment.
    data class Moment(val at: Long, val zone: String) {
        fun calendar(): Calendar = Calendar.getInstance(TimeZone.getTimeZone(zone)).apply { timeInMillis = at }
    }

    // getTimeZone falls back to GMT for an id it cannot read, which would show a wrong hour.
    fun momentOf(at: Long?, zone: String?): Moment? =
        if (at != null && zone != null && TimeZone.getTimeZone(zone).id == zone) Moment(at, zone) else null

    data class SnoozeUse(val enabled: Boolean, val count: Int, val max: Int)

    // A type no alarm has rings as a custom alarm.
    fun typeOf(raw: String): Type = Type.entries.firstOrNull { it.id == raw } ?: Type.CUSTOM

    // Jumu'ah is the Friday Dhuhr occurrence; a custom alarm has no prayer.
    fun prayerOf(type: Type): Prayer? = when (type) {
        Type.FAJR -> Prayer.FAJR
        Type.JUMMAH -> Prayer.JUMUAH
        Type.CUSTOM -> null
    }

    fun alarmNameOf(type: Type): AlarmName = when (type) {
        Type.FAJR -> AlarmName.FAJR
        Type.JUMMAH -> AlarmName.FRIDAY
        Type.CUSTOM -> AlarmName.CUSTOM
    }

    // The prayer's time heads the screen; with none stored, the clock does.
    fun header(type: Type, hasMoment: Boolean): Header {
        val prayer = prayerOf(type)
        // Only a prayer has a moment to show; a custom alarm keeps the clock.
        val time = if (hasMoment && prayer != null) Time.PRAYER else Time.CLOCK
        return Header(
            prayer = prayer,
            alarm = alarmNameOf(type),
            time = time,
            // A prayer alarm without its time shows the clock, said as the time now.
            heading = if (prayer != null && time == Time.CLOCK) Heading.CURRENT_TIME else Heading.RINGING_AT,
            announcement = if (prayer != null) Announcement.PRAYER else Announcement.CUSTOM,
        )
    }

    fun snoozeOpen(use: SnoozeUse): Boolean = use.enabled && use.count < use.max

    fun snoozeLeft(use: SnoozeUse): Int = if (use.enabled) maxOf(0, use.max - use.count) else 0

    // Snooze, or one line in its place, so the main button keeps its place.
    fun snoozePlace(open: Boolean, enabled: Boolean): SnoozePlace = when {
        open -> SnoozePlace.BUTTON
        enabled -> SnoozePlace.USED_UP
        else -> SnoozePlace.OFF
    }

    // As JS, a ring with a task ends on the solved panel; one with none just ends.
    fun solvedShowsPanel(tasks: List<WakeTasks.Task>): Boolean = tasks.isNotEmpty()
}
