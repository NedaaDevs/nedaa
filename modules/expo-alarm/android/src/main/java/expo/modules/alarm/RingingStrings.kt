package expo.modules.alarm

import expo.modules.alarm.RingingScreen.AlarmName
import expo.modules.alarm.RingingScreen.Announcement
import expo.modules.alarm.RingingScreen.Heading
import expo.modules.alarm.RingingScreen.Name
import expo.modules.alarm.RingingScreen.Prayer
import expo.modules.alarm.RingingScreen.SnoozePlace

// The string each ringing key draws, pinned by ringing-strings.tsv.
internal object RingingStrings {

    fun of(prayer: Prayer): Int = when (prayer) {
        Prayer.FAJR -> R.string.overlay_prayer_fajr
        Prayer.JUMUAH -> R.string.overlay_ringing_jumuah
    }

    fun of(alarm: AlarmName): Int = when (alarm) {
        AlarmName.FAJR -> R.string.overlay_ringing_fajr_alarm
        AlarmName.FRIDAY -> R.string.overlay_ringing_friday_alarm
        AlarmName.CUSTOM -> R.string.overlay_ringing_alarm
    }

    fun of(name: Name): Int = when (name) {
        is Prayer -> of(name)
        is AlarmName -> of(name)
    }

    fun of(heading: Heading): Int = when (heading) {
        Heading.CURRENT_TIME -> R.string.overlay_ringing_current_time
        Heading.RINGING_AT -> R.string.overlay_ringing_at
    }

    fun of(announcement: Announcement): Int = when (announcement) {
        Announcement.PRAYER -> R.string.overlay_ringing_announcement
        Announcement.CUSTOM -> R.string.overlay_ringing_custom
    }

    // The button draws its own plurals; the other places are one line.
    fun of(place: SnoozePlace): Int? = when (place) {
        SnoozePlace.BUTTON -> null
        SnoozePlace.USED_UP -> R.string.overlay_ringing_snooze_used_up
        SnoozePlace.OFF -> R.string.overlay_ringing_snooze_off
    }
}
