package dev.nedaa.android.widgets.common

import android.content.Context
import java.util.Locale
import java.util.TimeZone

/**
 * The app's chosen language + numeral preference (written to the DB by the JS
 * layer), so widgets format dates/numbers to match the in-app UI rather than the
 * device locale. Falls back to the device locale when the config is absent.
 */
data class WidgetConfig(
    val locale: Locale,
    val arabicNumerals: Boolean,
    /** The user's location zone, so a widget's "today" is the day the app is showing. */
    val timezone: TimeZone,
    val hijriDaysOffset: Int,
) {
    /** Eastern-Arabic digits when the app is Arabic and Western numerals are off. */
    fun localizeNumber(value: String): String {
        if (!arabicNumerals) return value
        val builder = StringBuilder(value.length)
        for (c in value) {
            builder.append(if (c in '0'..'9') ARABIC_DIGITS[c - '0'] else c)
        }
        return builder.toString()
    }

    fun localizeNumber(value: Int): String = localizeNumber(value.toString())

    companion object {
        private val ARABIC_DIGITS = charArrayOf('٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩')

        fun get(context: Context): WidgetConfig {
            var localeTag: String? = null
            var useWestern = false
            var zoneId: String? = null
            var hijriOffset = 0
            // The table may not exist yet on first launch (JS writes it on sync);
            // any failure falls through to the device-locale default.
            try {
                DatabaseProvider.getNedaaDatabase(context)?.use { db ->
                    db.rawQuery(
                        "SELECT locale, useWesternNumerals, timezone, hijriDaysOffset FROM widget_config WHERE id = 1",
                        null
                    ).use { c ->
                        if (c.moveToFirst()) {
                            localeTag = c.getString(0)
                            useWestern = c.getInt(1) == 1
                            // Added after the table shipped, so absent on an install that
                            // has not synced since.
                            if (!c.isNull(2)) zoneId = c.getString(2)
                            if (!c.isNull(3)) hijriOffset = c.getInt(3)
                        }
                    }
                }
            } catch (_: Exception) {
                // No config yet — use the device locale below.
            }
            val locale = localeTag?.let { Locale(it) } ?: Locale.getDefault()
            val arabicNumerals = locale.language == "ar" && !useWestern
            val zone = zoneId?.let { TimeZone.getTimeZone(it) } ?: TimeZone.getDefault()
            return WidgetConfig(locale, arabicNumerals, zone, hijriOffset)
        }
    }
}
