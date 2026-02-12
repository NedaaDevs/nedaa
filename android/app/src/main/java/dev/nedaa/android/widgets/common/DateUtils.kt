package dev.nedaa.android.widgets.common

import android.icu.text.SimpleDateFormat as IcuSimpleDateFormat
import android.icu.util.IslamicCalendar
import android.icu.util.ULocale
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Utility class for date formatting including Hijri calendar support
 */
object DateUtils {

    // Islamic month names in English
    private val ISLAMIC_MONTHS_EN = arrayOf(
        "Muharram", "Safar", "Rabi' al-Awwal", "Rabi' al-Thani",
        "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban",
        "Ramadan", "Shawwal", "Dhul Qi'dah", "Dhul Hijjah"
    )

    // Islamic month names in Arabic
    private val ISLAMIC_MONTHS_AR = arrayOf(
        "محرم", "صفر", "ربيع الأول", "ربيع الآخر",
        "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
        "رمضان", "شوال", "ذو القعدة", "ذو الحجة"
    )

    /**
     * Get Hijri date string for a given date (locale-aware)
     * Format: "day MonthName year" e.g., "26 Jumada al-Awwal 1447"
     */
    fun getHijriDateString(date: Date, timezone: TimeZone? = null): String {
        val locale = Locale.getDefault()
        return getHijriDateForLocale(date, timezone, locale)
    }

    /**
     * Get Hijri date string in Arabic
     */
    fun getHijriDateArabic(date: Date, timezone: TimeZone? = null): String {
        return getHijriDateForLocale(date, timezone, Locale("ar"))
    }

    /**
     * Get Hijri date string in English
     */
    fun getHijriDateEnglish(date: Date, timezone: TimeZone? = null): String {
        return getHijriDateForLocale(date, timezone, Locale.ENGLISH)
    }

    /**
     * Get Hijri date for a specific locale
     */
    private fun getHijriDateForLocale(date: Date, timezone: TimeZone?, locale: Locale): String {
        return try {
            val tz = timezone ?: TimeZone.getDefault()

            // Create Islamic calendar and set the date
            val islamicCalendar = IslamicCalendar()
            islamicCalendar.timeZone = android.icu.util.TimeZone.getTimeZone(tz.id)
            islamicCalendar.time = date

            // Extract day, month, year from Islamic calendar
            val day = islamicCalendar.get(IslamicCalendar.DAY_OF_MONTH)
            val month = islamicCalendar.get(IslamicCalendar.MONTH)
            val year = islamicCalendar.get(IslamicCalendar.YEAR)

            // Get month name based on locale
            val monthNames = if (locale.language == "ar") ISLAMIC_MONTHS_AR else ISLAMIC_MONTHS_EN
            val monthName = if (month in 0..11) monthNames[month] else ""

            val dateStr = "$day $monthName $year"
            if (locale.language == "ar") "\u200F$dateStr" else dateStr
        } catch (e: Exception) {
            SimpleDateFormat("dd/MM/yyyy", locale).format(date)
        }
    }

    /**
     * Get Gregorian date string (locale-aware)
     */
    fun getGregorianDateString(date: Date, timezone: TimeZone? = null): String {
        val tz = timezone ?: TimeZone.getDefault()
        val locale = Locale.getDefault()
        val formatter = SimpleDateFormat("d MMMM yyyy", locale)
        formatter.timeZone = tz
        return formatter.format(date)
    }

    /**
     * Get short Gregorian date string (locale-aware)
     */
    fun getGregorianDateShort(date: Date, timezone: TimeZone? = null): String {
        val tz = timezone ?: TimeZone.getDefault()
        val locale = Locale.getDefault()
        val formatter = SimpleDateFormat("d MMM", locale)
        formatter.timeZone = tz
        return formatter.format(date)
    }

    /**
     * Format time in 12-hour format with AM/PM
     */
    fun formatTime12Hour(date: Date, timezone: TimeZone? = null): String {
        val tz = timezone ?: TimeZone.getDefault()
        val locale = Locale.getDefault()
        val formatter = SimpleDateFormat("h:mm a", locale)
        formatter.timeZone = tz
        return formatter.format(date)
    }

    /**
     * Format time in 24-hour format
     */
    fun formatTime24Hour(date: Date, timezone: TimeZone? = null): String {
        val tz = timezone ?: TimeZone.getDefault()
        val formatter = SimpleDateFormat("HH:mm", Locale.US)
        formatter.timeZone = tz
        return formatter.format(date)
    }
}
