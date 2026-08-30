package dev.nedaa.android.widgets.common

import android.content.Context
import android.content.res.Configuration
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
    /** Normalize digits to the numeral style selected in the app. */
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

    /** Resolve Android string resources using Nedaa's selected app language. */
    fun localizedContext(context: Context): Context {
        val widgetLocale = locale
        val configuration = Configuration(context.resources.configuration).apply {
            setLocale(widgetLocale)
            setLayoutDirection(widgetLocale)
        }
        return context.createConfigurationContext(configuration)
    }

    companion object {
        private val WESTERN_DIGITS = charArrayOf('0', '1', '2', '3', '4', '5', '6', '7', '8', '9')
        private val ARABIC_DIGITS = charArrayOf('٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩')
        private val PERSIAN_DIGITS = charArrayOf('۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹')

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
            val locale = localeTag
                ?.replace('_', '-')
                ?.let(Locale::forLanguageTag)
                ?.takeUnless { it.language.isBlank() }
                ?: Locale.getDefault()
            val arabicNumerals = locale.language == "ar" && !useWestern
            val zone = zoneId?.let { TimeZone.getTimeZone(it) } ?: TimeZone.getDefault()
            return WidgetConfig(locale, arabicNumerals, zone, hijriOffset)
        }
    }
}
