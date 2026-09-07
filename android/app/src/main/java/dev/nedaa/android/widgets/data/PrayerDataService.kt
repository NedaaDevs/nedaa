package dev.nedaa.android.widgets.data

import android.content.Context
import android.util.Log
import dev.nedaa.android.widgets.common.Snapshot
import dev.nedaa.android.widgets.common.SnapshotPrayerTimes
import dev.nedaa.android.widgets.common.WidgetSnapshot
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** Prayer times for the widgets, read from the snapshot JS writes. */
class PrayerDataService(private val context: Context) {

    companion object {
        private const val TAG = "PrayerDataService"

        private val ISO_FORMATS = listOf(
            "yyyy-MM-dd'T'HH:mm:ssXXX",
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
            "yyyy-MM-dd'T'HH:mm:ssZ",
            "yyyy-MM-dd'T'HH:mm:ss.SSSZ",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
        )

        /** The snapshot day for [dateInt], or null when the snapshot does not carry it. */
        internal fun dayFrom(
            snapshot: SnapshotPrayerTimes?,
            dateInt: Int,
            showSunrise: Boolean,
            timezone: String,
        ): DayPrayers? {
            val day = snapshot?.days?.firstOrNull { it.date == dateInt } ?: return null
            return DayPrayers(
                date = dateInt,
                timezone = timezone,
                prayers = buildPrayerList(day.timings, day.otherTimings, showSunrise, timezone),
            )
        }

        private fun buildPrayerList(
            timings: JSONObject,
            otherTimings: JSONObject,
            showSunrise: Boolean,
            timezone: String,
        ): List<PrayerData> {
            val tz = TimeZone.getTimeZone(timezone)
            val prayers = mutableListOf<PrayerData>()
            prayers.add(PrayerData(PrayerData.FAJR, parseIsoDate(timings.getString("fajr"))))
            if (showSunrise && otherTimings.has("sunrise")) {
                prayers.add(PrayerData(PrayerData.SUNRISE, parseIsoDate(otherTimings.getString("sunrise"))))
            }
            // Dhuhr is Jumuah on Friday.
            val dhuhrTime = parseIsoDate(timings.getString("dhuhr"))
            val dayOfWeek = Calendar.getInstance(tz).apply { time = dhuhrTime }.get(Calendar.DAY_OF_WEEK)
            val dhuhrName = if (dayOfWeek == Calendar.FRIDAY) PrayerData.JUMUAH else PrayerData.DHUHR
            prayers.add(PrayerData(dhuhrName, dhuhrTime))
            prayers.add(PrayerData(PrayerData.ASR, parseIsoDate(timings.getString("asr"))))
            prayers.add(PrayerData(PrayerData.MAGHRIB, parseIsoDate(timings.getString("maghrib"))))
            prayers.add(PrayerData(PrayerData.ISHA, parseIsoDate(timings.getString("isha"))))
            return prayers.sortedBy { it.time }
        }

        /** The offset travels inside the ISO string, so no zone is applied here. */
        private fun parseIsoDate(isoString: String): Date {
            for (pattern in ISO_FORMATS) {
                try {
                    SimpleDateFormat(pattern, Locale.US).parse(isoString)?.let { return it }
                } catch (_: Exception) {
                    // next format
                }
            }
            Log.e(TAG, "Error parsing date: $isoString - no matching format found")
            return Date()
        }
    }

    // One read per service instance; every public call on the same instance sees one document.
    private val snapshot: Snapshot? by lazy { WidgetSnapshot.load(context) }

    private val timezone: String
        get() = snapshot?.prayerTimes?.timezone?.takeIf { it.isNotEmpty() } ?: TimeZone.getDefault().id

    fun getTodaysPrayerTimes(showSunrise: Boolean = true): DayPrayers? {
        val tz = timezone
        return dayFrom(snapshot?.prayerTimes, todayInt(tz), showSunrise, tz)
    }

    fun getTomorrowsPrayerTimes(showSunrise: Boolean = true): DayPrayers? {
        val tz = timezone
        val cal = Calendar.getInstance(TimeZone.getTimeZone(tz)).apply { add(Calendar.DAY_OF_YEAR, 1) }
        return dayFrom(snapshot?.prayerTimes, WidgetSnapshot.dateIntFor(cal.timeInMillis, cal.timeZone), showSunrise, tz)
    }

    /** The next prayer today, or tomorrow's first when today's have all passed. */
    fun getNextPrayer(showSunrise: Boolean = true): PrayerData? =
        getTodaysPrayerTimes(showSunrise)?.getNextPrayer()
            ?: getTomorrowsPrayerTimes(showSunrise)?.prayers?.firstOrNull()

    fun getPreviousPrayer(showSunrise: Boolean = true): PrayerData? =
        getTodaysPrayerTimes(showSunrise)?.getPreviousPrayer()

    private fun todayInt(tz: String): Int =
        WidgetSnapshot.dateIntFor(System.currentTimeMillis(), TimeZone.getTimeZone(tz))
}
