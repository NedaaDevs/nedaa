package dev.nedaa.android.widgets.data

import android.content.Context
import android.util.Log
import dev.nedaa.android.widgets.common.DatabaseProvider
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Service for fetching prayer times from the SQLite database
 */
class PrayerDataService(private val context: Context) {

    companion object {
        private const val TAG = "PrayerDataService"
        private const val TABLE_NAME = "prayer_times"
    }

    /**
     * Get today's prayer times
     */
    fun getTodaysPrayerTimes(showSunrise: Boolean = true): DayPrayers? {
        val timezone = getTimezone() ?: TimeZone.getDefault().id
        val dateInt = getTodayDateInt(timezone)
        return getPrayerTimesForDate(dateInt, showSunrise, timezone)
    }

    /**
     * Get tomorrow's prayer times
     */
    fun getTomorrowsPrayerTimes(showSunrise: Boolean = true): DayPrayers? {
        val timezone = getTimezone() ?: TimeZone.getDefault().id
        val calendar = Calendar.getInstance(TimeZone.getTimeZone(timezone))
        calendar.add(Calendar.DAY_OF_YEAR, 1)
        val dateInt = calendarToDateInt(calendar)
        return getPrayerTimesForDate(dateInt, showSunrise, timezone)
    }

    /**
     * Get the next upcoming prayer (could be today or tomorrow)
     */
    fun getNextPrayer(showSunrise: Boolean = true): PrayerData? {
        val todayPrayers = getTodaysPrayerTimes(showSunrise)
        val nextToday = todayPrayers?.getNextPrayer()

        if (nextToday != null) {
            return nextToday
        }

        // If no more prayers today, get first prayer tomorrow
        val tomorrowPrayers = getTomorrowsPrayerTimes(showSunrise)
        return tomorrowPrayers?.prayers?.firstOrNull()
    }

    /**
     * Get the most recently passed prayer
     */
    fun getPreviousPrayer(showSunrise: Boolean = true): PrayerData? {
        val todayPrayers = getTodaysPrayerTimes(showSunrise)
        return todayPrayers?.getPreviousPrayer()
    }

    /**
     * Get prayer times for a specific date
     */
    private fun getPrayerTimesForDate(dateInt: Int, showSunrise: Boolean, timezone: String): DayPrayers? {
        return try {
            val db = DatabaseProvider.getNedaaDatabase(context)
            if (db == null) {
                Log.e(TAG, "Database is null - could not open nedaa.db")
                return null
            }

            db.use { database ->
                Log.d(TAG, "Querying prayer times for date: $dateInt")
                val cursor = database.rawQuery(
                    "SELECT timings, other_timings FROM $TABLE_NAME WHERE date = ?",
                    arrayOf(dateInt.toString())
                )

                cursor.use {
                    if (it.moveToFirst()) {
                        val timingsJson = it.getString(0)
                        val otherTimingsJson = it.getString(1)
                        Log.d(TAG, "Found prayer times for $dateInt: timings=$timingsJson")

                        val prayers = buildPrayerList(
                            timingsJson = timingsJson,
                            otherTimingsJson = otherTimingsJson,
                            dateInt = dateInt,
                            showSunrise = showSunrise,
                            timezone = timezone
                        )

                        DayPrayers(
                            date = dateInt,
                            timezone = timezone,
                            prayers = prayers
                        )
                    } else {
                        Log.w(TAG, "No prayer times found for date: $dateInt")
                        null
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching prayer times for date: $dateInt", e)
            null
        }
    }

    /**
     * Build the list of prayers from JSON data
     */
    private fun buildPrayerList(
        timingsJson: String,
        otherTimingsJson: String,
        dateInt: Int,
        showSunrise: Boolean,
        timezone: String
    ): List<PrayerData> {
        val prayers = mutableListOf<PrayerData>()
        val timings = JSONObject(timingsJson)
        val otherTimings = JSONObject(otherTimingsJson)
        val tz = TimeZone.getTimeZone(timezone)

        // Add Fajr
        prayers.add(PrayerData(PrayerData.FAJR, parseIsoDate(timings.getString("fajr"), tz)))

        // Add Sunrise if requested
        if (showSunrise && otherTimings.has("sunrise")) {
            prayers.add(PrayerData(PrayerData.SUNRISE, parseIsoDate(otherTimings.getString("sunrise"), tz)))
        }

        // Add Dhuhr (or Jumuah on Friday)
        val dhuhrTime = parseIsoDate(timings.getString("dhuhr"), tz)
        val calendar = Calendar.getInstance(tz).apply { time = dhuhrTime }
        val prayerName = if (calendar.get(Calendar.DAY_OF_WEEK) == Calendar.FRIDAY) {
            PrayerData.JUMUAH
        } else {
            PrayerData.DHUHR
        }
        prayers.add(PrayerData(prayerName, dhuhrTime))

        // Add Asr
        prayers.add(PrayerData(PrayerData.ASR, parseIsoDate(timings.getString("asr"), tz)))

        // Add Maghrib
        prayers.add(PrayerData(PrayerData.MAGHRIB, parseIsoDate(timings.getString("maghrib"), tz)))

        // Add Isha
        prayers.add(PrayerData(PrayerData.ISHA, parseIsoDate(timings.getString("isha"), tz)))

        return prayers.sortedBy { it.time }
    }

    /**
     * Parse ISO 8601 date string to Date
     * Handles formats like: 2025-11-26T05:18:00+03:00
     */
    private fun parseIsoDate(isoString: String, timezone: TimeZone): Date {
        // List of formats to try, in order of preference
        val formats = listOf(
            "yyyy-MM-dd'T'HH:mm:ssXXX",      // 2025-11-26T05:18:00+03:00
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",  // 2025-11-26T05:18:00.000+03:00
            "yyyy-MM-dd'T'HH:mm:ssZ",        // 2025-11-26T05:18:00+0300
            "yyyy-MM-dd'T'HH:mm:ss.SSSZ",    // 2025-11-26T05:18:00.000+0300
            "yyyy-MM-dd'T'HH:mm:ss'Z'",      // 2025-11-26T05:18:00Z (UTC)
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"   // 2025-11-26T05:18:00.000Z (UTC)
        )

        for (pattern in formats) {
            try {
                val format = SimpleDateFormat(pattern, Locale.US)
                val parsed = format.parse(isoString)
                if (parsed != null) {
                    return parsed
                }
            } catch (e: Exception) {
                // Try next format
            }
        }

        Log.e(TAG, "Error parsing date: $isoString - no matching format found")
        return Date()
    }

    /**
     * Get the timezone from the database
     */
    private fun getTimezone(): String? {
        return try {
            DatabaseProvider.getNedaaDatabase(context)?.use { db ->
                val cursor = db.rawQuery(
                    "SELECT timezone FROM $TABLE_NAME LIMIT 1",
                    null
                )
                cursor.use {
                    if (it.moveToFirst()) it.getString(0) else null
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting timezone", e)
            null
        }
    }

    /**
     * Get today's date as YYYYMMDD integer
     */
    private fun getTodayDateInt(timezone: String): Int {
        val calendar = Calendar.getInstance(TimeZone.getTimeZone(timezone))
        return calendarToDateInt(calendar)
    }

    /**
     * Convert Calendar to YYYYMMDD integer
     */
    private fun calendarToDateInt(calendar: Calendar): Int {
        val year = calendar.get(Calendar.YEAR)
        val month = calendar.get(Calendar.MONTH) + 1
        val day = calendar.get(Calendar.DAY_OF_MONTH)
        return year * 10000 + month * 100 + day
    }
}
