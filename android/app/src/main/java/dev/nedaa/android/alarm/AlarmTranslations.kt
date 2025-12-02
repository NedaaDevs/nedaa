package dev.nedaa.android.alarm

import android.content.Context
import dev.nedaa.android.R

/**
 * Helper for managing alarm UI translations using Android string resources.
 * Automatically uses the device's language setting.
 */
object AlarmTranslations {

    /**
     * Get the prayer title based on alarm type.
     */
    fun getPrayerTitle(context: Context, alarmType: String): String {
        return when (alarmType) {
            "fajr" -> context.getString(R.string.alarm_fajr_prayer)
            "jummah" -> context.getString(R.string.alarm_jummah_prayer)
            else -> context.getString(R.string.alarm_fajr_prayer)
        }
    }

    /**
     * Get the alarm body/subtitle based on alarm type.
     */
    fun getAlarmBody(context: Context, alarmType: String): String {
        return when (alarmType) {
            "fajr" -> context.getString(R.string.alarm_prayer_better_than_sleep)
            "jummah" -> context.getString(R.string.alarm_jummah_reminder)
            else -> context.getString(R.string.alarm_prayer_better_than_sleep)
        }
    }
}
