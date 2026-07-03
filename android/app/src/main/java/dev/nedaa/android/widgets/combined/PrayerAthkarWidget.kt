package dev.nedaa.android.widgets.combined

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.layout.fillMaxSize
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import dev.nedaa.android.widgets.common.NedaaWidgetTheme
import dev.nedaa.android.widgets.common.WidgetConfig
import dev.nedaa.android.widgets.common.WidgetSizes
import dev.nedaa.android.widgets.data.AthkarDataService
import dev.nedaa.android.widgets.data.PrayerDataService

/**
 * Combined Prayer Times + Athkar Progress widget (4x2), resizable from Compact to Wide.
 * Shows next prayer and athkar completion status side by side. The single flex-based
 * layout (weighted columns, no fixed widths) already adapts across the responsive range.
 */
class PrayerAthkarWidget : GlanceAppWidget() {

    companion object {
        val SHOW_COUNTDOWN_KEY = booleanPreferencesKey("show_countdown")
        val SHOW_SUNRISE_KEY = booleanPreferencesKey("show_sunrise")
    }

    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    override val sizeMode = SizeMode.Responsive(
        setOf(WidgetSizes.COMPACT, WidgetSizes.MEDIUM, WidgetSizes.WIDE)
    )

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val prefs = currentState<Preferences>()
            val showCountdown = prefs[SHOW_COUNTDOWN_KEY] ?: true
            val showSunrise = prefs[SHOW_SUNRISE_KEY] ?: true

            val prayerService = PrayerDataService(context)
            val athkarService = AthkarDataService(context)

            val todayPrayers = prayerService.getTodaysPrayerTimes(showSunrise)
            val nextPrayer = prayerService.getNextPrayer(showSunrise)
            val previousPrayer = prayerService.getPreviousPrayer(showSunrise)
            val athkarSummary = athkarService.getAthkarSummary()
            val config = WidgetConfig.get(context)

            NedaaWidgetTheme {
                PrayerAthkarContent(
                    prayers = todayPrayers?.prayers ?: emptyList(),
                    nextPrayer = nextPrayer,
                    previousPrayer = previousPrayer,
                    athkarSummary = athkarSummary,
                    config = config,
                    timezone = todayPrayers?.getTimezoneObj(),
                    currentDate = todayPrayers?.getDateAsDate(),
                    modifier = GlanceModifier.fillMaxSize()
                )
            }
        }
    }
}
