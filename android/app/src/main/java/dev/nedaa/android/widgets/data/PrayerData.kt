package dev.nedaa.android.widgets.data

import android.text.format.DateFormat
import android.content.Context
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Represents a single prayer time
 */
data class PrayerData(
    val name: String,
    val time: Date
) {
    /**
     * Check if this prayer time has passed
     */
    val isPast: Boolean
        get() = time.time < System.currentTimeMillis()

    /**
     * Get time until this prayer in milliseconds
     * Negative if prayer has passed
     */
    val timeUntil: Long
        get() = time.time - System.currentTimeMillis()

    /**
     * Get time since this prayer in milliseconds
     * Negative if prayer hasn't happened yet
     */
    val timeSince: Long
        get() = System.currentTimeMillis() - time.time

    /**
     * Format the time in 12-hour format with AM/PM (locale-aware, default timezone)
     */
    fun formatTime(): String {
        val locale = Locale.getDefault()
        val formatter = SimpleDateFormat("h:mm a", locale)
        formatter.timeZone = TimeZone.getDefault()
        return formatter.format(time)
    }

    /**
     * Format time in 12-hour format with specific timezone
     */
    fun formatTime12Hour(timezone: TimeZone? = null): String {
        val tz = timezone ?: TimeZone.getDefault()
        val locale = Locale.getDefault()
        val formatter = SimpleDateFormat("h:mm a", locale)
        formatter.timeZone = tz
        return formatter.format(time)
    }

    /**
     * Format the time respecting system 24-hour setting (with context)
     */
    fun formatTime(context: Context, timezone: TimeZone? = null): String {
        val tz = timezone ?: TimeZone.getDefault()
        val locale = Locale.getDefault()
        val pattern = if (DateFormat.is24HourFormat(context)) "HH:mm" else "h:mm a"
        val formatter = SimpleDateFormat(pattern, locale)
        formatter.timeZone = tz
        return formatter.format(time)
    }

    /**
     * Format time until prayer as human readable string
     */
    fun formatTimeUntil(): String {
        val millis = timeUntil
        if (millis < 0) return ""

        val totalMinutes = millis / (1000 * 60)
        val hours = totalMinutes / 60
        val minutes = totalMinutes % 60

        return when {
            hours > 0 -> "${hours}h ${minutes}m"
            else -> "${minutes}m"
        }
    }

    companion object {
        // Prayer name constants matching iOS
        const val FAJR = "fajr"
        const val SUNRISE = "sunrise"
        const val DHUHR = "dhuhr"
        const val JUMUAH = "jumuah"
        const val ASR = "asr"
        const val MAGHRIB = "maghrib"
        const val ISHA = "isha"
    }
}

/**
 * Contains all prayer times for a day
 */
data class DayPrayers(
    val date: Int,  // YYYYMMDD format
    val timezone: String,
    val prayers: List<PrayerData>
) {
    /**
     * Get the TimeZone object
     */
    fun getTimezoneObj(): TimeZone = TimeZone.getTimeZone(timezone)

    /**
     * Get the date as a Date object (at midnight in the timezone)
     */
    fun getDateAsDate(): Date {
        val year = date / 10000
        val month = (date % 10000) / 100
        val day = date % 100

        val calendar = Calendar.getInstance(getTimezoneObj())
        calendar.set(year, month - 1, day, 0, 0, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        return calendar.time
    }

    /**
     * Get the next upcoming prayer
     */
    fun getNextPrayer(): PrayerData? {
        return prayers.firstOrNull { !it.isPast }
    }

    /**
     * Get the most recently passed prayer
     */
    fun getPreviousPrayer(): PrayerData? {
        return prayers.lastOrNull { it.isPast }
    }
}
