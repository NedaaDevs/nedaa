package dev.nedaa.android.widgets.prayer

import android.content.Context
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.glance.layout.fillMaxSize
import dev.nedaa.android.widgets.data.PrayerDataService

/**
 * Medium Prayer Times widget (4x2)
 */
class PrayerTimesWidgetMedium : GlanceAppWidget() {

    companion object {
        val SHOW_SUNRISE_KEY = booleanPreferencesKey("show_sunrise")
        private val SIZE = DpSize(250.dp, 110.dp)
    }

    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val prefs = currentState<Preferences>()
            val showSunrise = prefs[SHOW_SUNRISE_KEY] ?: true

            val prayerService = PrayerDataService(context)
            val dayPrayers = prayerService.getTodaysPrayerTimes(showSunrise)
            val nextPrayer = prayerService.getNextPrayer(showSunrise)
            val previousPrayer = prayerService.getPreviousPrayer(showSunrise)

            PrayerTimesContent(
                dayPrayers = dayPrayers,
                nextPrayer = nextPrayer,
                previousPrayer = previousPrayer,
                widgetSize = WidgetSize.MEDIUM,
                modifier = GlanceModifier.fillMaxSize()
            )
        }
    }
}
