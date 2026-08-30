package dev.nedaa.android.widgets.common

import android.content.Context
import java.util.Locale
import java.util.TimeZone

/**
 * How a widget formats itself. A widget sits on the home screen next to other
 * widgets, so its language comes from the device and not from the language the
 * user picked inside the app. The numeral toggle, the timezone and the Hijri
 * offset are user preferences, so the JS layer writes those to the DB.
 */
data class WidgetConfig(
    /** The device locale. Android resolves widget string resources against it too. */
    val locale: Locale,
    val arabicNumerals: Boolean,
    /** The user's location zone, so a widget's "today" is the day the app is showing. */
    val timezone: TimeZone,
    val hijriDaysOffset: Int,
) {
    /**
     * Normalize digits to the numeral style this widget shows. Date formatters follow
     * the device locale, so digits arrive in either style and both need a conversion.
     */
    fun localizeNumber(value: String): String {
        val builder = StringBuilder(value.length)
        for (c in value) {
            val digit = when {
                c in '0'..'9' -> c - '0'
                c in ARABIC_DIGITS -> ARABIC_DIGITS.indexOf(c)
                c in PERSIAN_DIGITS -> PERSIAN_DIGITS.indexOf(c)
                else -> -1
            }
            builder.append(
                if (digit < 0) c
                else if (arabicNumerals) ARABIC_DIGITS[digit]
                else WESTERN_DIGITS[digit]
            )
        }
        return builder.toString()
    }

    fun localizeNumber(value: Int): String = localizeNumber(value.toString())

    companion object {
        private val WESTERN_DIGITS = charArrayOf('0', '1', '2', '3', '4', '5', '6', '7', '8', '9')
        private val ARABIC_DIGITS = charArrayOf('٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩')
        private val PERSIAN_DIGITS = charArrayOf('۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹')

        fun get(context: Context): WidgetConfig {
            var useWestern = false
            var zoneId: String? = null
            var hijriOffset = 0
            // The table may not exist yet on first launch (JS writes it on sync);
            // any failure falls through to the defaults below.
            try {
                DatabaseProvider.getNedaaDatabase(context)?.use { db ->
                    db.rawQuery(
                        "SELECT useWesternNumerals, timezone, hijriDaysOffset FROM widget_config WHERE id = 1",
                        null
                    ).use { c ->
                        if (c.moveToFirst()) {
                            useWestern = c.getInt(0) == 1
                            // Added after the table shipped, so absent on an install that
                            // has not synced since.
                            if (!c.isNull(1)) zoneId = c.getString(1)
                            if (!c.isNull(2)) hijriOffset = c.getInt(2)
                        }
                    }
                }
            } catch (_: Exception) {
                // No config yet — use the defaults.
            }
            val locale = deviceLocale(context)
            val arabicNumerals = locale.language == "ar" && !useWestern
            val zone = zoneId?.let { TimeZone.getTimeZone(it) } ?: TimeZone.getDefault()
            return WidgetConfig(locale, arabicNumerals, zone, hijriOffset)
        }

        /**
         * The locale Android resolves this widget's string resources against, so the
         * digits and the dates match the strings. Locale.getDefault() can drift from
         * the resource configuration, so read the configuration itself.
         */
        private fun deviceLocale(context: Context): Locale {
            val locales = context.resources.configuration.locales
            return if (locales.isEmpty) Locale.getDefault() else locales[0]
        }
    }
}
