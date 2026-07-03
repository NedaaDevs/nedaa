package dev.nedaa.android.widgets.common

import android.content.Context
import java.util.Locale

/**
 * The app's chosen language + numeral preference (written to the DB by the JS
 * layer), so widgets format dates/numbers to match the in-app UI rather than the
 * device locale. Falls back to the device locale when the config is absent.
 */
data class WidgetConfig(val locale: Locale, val arabicNumerals: Boolean) {
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
            // The table may not exist yet on first launch (JS writes it on sync);
            // any failure falls through to the device-locale default.
            try {
                DatabaseProvider.getNedaaDatabase(context)?.use { db ->
                    db.rawQuery(
                        "SELECT locale, useWesternNumerals FROM widget_config WHERE id = 1",
                        null
                    ).use { c ->
                        if (c.moveToFirst()) {
                            localeTag = c.getString(0)
                            useWestern = c.getInt(1) == 1
                        }
                    }
                }
            } catch (_: Exception) {
                // No config yet — use the device locale below.
            }
            val locale = localeTag?.let { Locale(it) } ?: Locale.getDefault()
            val arabicNumerals = locale.language == "ar" && !useWestern
            return WidgetConfig(locale, arabicNumerals)
        }
    }
}
