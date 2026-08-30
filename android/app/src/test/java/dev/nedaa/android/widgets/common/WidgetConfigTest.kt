package dev.nedaa.android.widgets.common

import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Locale
import java.util.TimeZone

class WidgetConfigTest {
    private val timezone = TimeZone.getTimeZone("Asia/Riyadh")

    @Test
    fun `localizeNumber uses Arabic-Indic digits when enabled`() {
        val config = WidgetConfig(Locale.forLanguageTag("ar"), true, timezone, 0)

        assertEquals("١٢:٣٤", config.localizeNumber("12:34"))
    }

    @Test
    fun `localizeNumber restores Western digits when Arabic numerals are disabled`() {
        // An Arabic device formats times as ١٢:٣٤, so the Western-numerals
        // preference has to convert back rather than pass the value through.
        val config = WidgetConfig(Locale.forLanguageTag("ar"), false, timezone, 0)

        assertEquals("12:34", config.localizeNumber("١٢:٣٤"))
        assertEquals("12:34", config.localizeNumber("۱۲:۳۴"))
    }

    @Test
    fun `localizeNumber leaves separators and letters alone`() {
        val config = WidgetConfig(Locale.forLanguageTag("ar"), true, timezone, 0)

        assertEquals("رمضان · ٤٢", config.localizeNumber("رمضان · 42"))
    }
}
