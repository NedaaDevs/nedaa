package io.nedaa.nedaaApp

import android.content.Context
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import org.json.JSONObject
import java.time.temporal.ChronoUnit

data class Prayer(val name: String, val dateTime: ZonedDateTime)

// TODO: Better error 
data class PrayerTimes(
    val prayers: List<Prayer>,
    val calculationMethod: Int,
    val timezone: String,
) {
    companion object {
        fun parsePrayerTimes(json: String): PrayerTimes {
            val jsonObject = JSONObject(json)
            val prayerTimesObject = jsonObject.getJSONObject("prayerTimes")

            val prayers =
                listOf(
                    Prayer(
                        name = "Fajr",
                        dateTime = ZonedDateTime.parse(prayerTimesObject.getString("Fajr"))
                    ),
                    Prayer(
                        name = "Sunrise",
                        dateTime =
                        ZonedDateTime.parse(
                            prayerTimesObject.getString("Sunrise")
                        )
                    ),
                    Prayer(
                        name = "Dhuhr",
                        dateTime = ZonedDateTime.parse(prayerTimesObject.getString("Dhuhr"))
                    ),
                    Prayer(
                        name = "Asr",
                        dateTime = ZonedDateTime.parse(prayerTimesObject.getString("Asr"))
                    ),
                    Prayer(
                        name = "Maghrib",
                        dateTime =
                        ZonedDateTime.parse(
                            prayerTimesObject.getString("Maghrib")
                        )
                    ),
                    Prayer(
                        name = "Isha",
                        dateTime = ZonedDateTime.parse(prayerTimesObject.getString("Isha"))
                    )
                )

            return PrayerTimes(
                prayers = prayers,
                calculationMethod = jsonObject.getInt("calculationMethod"),
                timezone = jsonObject.getString("timezone"),
            )
        }
    }
}

class PrayerTimeService(private val context: Context) {

    private lateinit var dbHelper: DatabaseHelper

    private fun openDb() {
        dbHelper = DatabaseHelper(context)
        dbHelper.openDatabase()
    }

    private fun closeDb() {
        dbHelper.closeDatabase()
    }

    fun getTimezone(): String? {
        return dbHelper.getTimezone()
    }

    private fun getPrayersForDate(date: LocalDate): PrayerTimes? {
        val json =
            dbHelper.getPrayerTimesForDate(
                date.format(DateTimeFormatter.ofPattern("yyyyMMdd")).toInt()
            )
                ?: return null
        return PrayerTimes.parsePrayerTimes(json)
    }

    private fun getTimeForTimezone(timezone: String): ZonedDateTime {
        val timezoneId = ZoneId.of(timezone)
        return ZonedDateTime.now(timezoneId)
    }

    private fun getDateForTimezone(timezone: String): LocalDate {
        val timezoneId = ZoneId.of(timezone)
        return ZonedDateTime.now(timezoneId).toLocalDate()
    }

    fun getTodayPrayers(): PrayerTimes? {
        openDb()
        val timezone = getTimezone() ?: return null
        val today = getDateForTimezone(timezone)
        return getPrayersForDate(today)
    }

    private fun getYesterdayPrayers(): PrayerTimes? {
        val timezone = dbHelper.getTimezone() ?: return null
        val yesterday = getDateForTimezone(timezone).minusDays(1)
        return getPrayersForDate(yesterday)
    }

    private fun getTomorrowPrayers(): PrayerTimes? {
        val timezone = dbHelper.getTimezone() ?: return null
        val tomorrow = getDateForTimezone(timezone).plusDays(1)
        return getPrayersForDate(tomorrow)
    }

    fun getNextPrayer(): Prayer? {
        openDb()
        val timezone = dbHelper.getTimezone() ?: return null
        val currentTime = ZonedDateTime.now(ZoneId.of(timezone))

        val todayPrayers = getTodayPrayers()?.prayers ?: return null

        val sortedPrayers = todayPrayers.sortedBy { ZonedDateTime.parse(it.dateTime.toString()) }
        for (prayer in sortedPrayers) {
            val prayerTime = ZonedDateTime.parse(prayer.dateTime.toString())
            if (currentTime.isBefore(prayerTime)) {
                return prayer
            }
        }

        // If no next prayer is found, get the first prayer of tomorrow
        val tomorrowPrayers = getTomorrowPrayers()?.prayers ?: return null
        return tomorrowPrayers.firstOrNull()
    }

    fun getPreviousPrayer(): Prayer? {
        val timezone = dbHelper.getTimezone() ?: return null
        val currentTime = ZonedDateTime.now(ZoneId.of(timezone))
        val todayPrayers = getTodayPrayers()?.prayers ?: return null
        val sortedPrayers = todayPrayers.sortedBy { ZonedDateTime.parse(it.dateTime.toString()) }

        for (prayer in sortedPrayers.reversed()) {
            val prayerTime = ZonedDateTime.parse(prayer.dateTime.toString())
            if (currentTime.isAfter(prayerTime)) {
                return prayer
            }
        }
        // If no previous prayer is found, get the last prayer of yesterday
        val yesterdayPrayers = getYesterdayPrayers()?.prayers ?: return null
        return yesterdayPrayers.lastOrNull()
    }

    fun calculateNextUpdateDate(
        currentDate: ZonedDateTime,
        nextPrayerDate: ZonedDateTime,
        previousPrayerDate: ZonedDateTime
    ): ZonedDateTime {
        val timeIntervalToNextPrayer = ChronoUnit.MINUTES.between(currentDate, nextPrayerDate)
        val timeIntervalSincePreviousPrayer =
            ChronoUnit.MINUTES.between(previousPrayerDate, currentDate)

        return when {
            timeIntervalSincePreviousPrayer < 30 -> {
                // If the previous prayer was less than 30 minutes ago, update 30 minutes after the previous prayer
                previousPrayerDate.plusMinutes(30)
            }

            timeIntervalToNextPrayer > 60 -> {
                // If the next prayer is more than 1 hour away, update 60 minutes before the next prayer
                nextPrayerDate.minusMinutes(60)
            }

            else -> {
                // Otherwise, update 30 minutes after the next prayer
                nextPrayerDate.plusMinutes(30)
            }
        }
    }
}
