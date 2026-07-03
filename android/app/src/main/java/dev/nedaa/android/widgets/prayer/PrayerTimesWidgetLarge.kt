package dev.nedaa.android.widgets.prayer

import android.content.Context
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
import dev.nedaa.android.widgets.common.NedaaWidgetTheme
import dev.nedaa.android.widgets.common.WidgetConfig
import dev.nedaa.android.widgets.common.WidgetSizes
import dev.nedaa.android.widgets.data.PrayerDataService

/**
 * Large Prayer Times widget (4x4), resizable down to Compact / Medium.
 */
class PrayerTimesWidgetLarge : GlanceAppWidget() {

    companion object {
        val SHOW_SUNRISE_KEY = booleanPreferencesKey("show_sunrise")
    }

    override val stateDefinition: GlanceStateDefinition<*> = PreferencesGlanceStateDefinition

    override val sizeMode = SizeMode.Responsive(
        setOf(WidgetSizes.COMPACT, WidgetSizes.MEDIUM, WidgetSizes.WIDE)
    )

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val prefs = currentState<Preferences>()
            val showSunrise = prefs[SHOW_SUNRISE_KEY] ?: true

            val prayerService = PrayerDataService(context)
            val dayPrayers = prayerService.getTodaysPrayerTimes(showSunrise)
            val nextPrayer = prayerService.getNextPrayer(showSunrise)
            val previousPrayer = prayerService.getPreviousPrayer(showSunrise)
            val config = WidgetConfig.get(context)

            NedaaWidgetTheme {
                ResponsivePrayerTimesContent(
                    dayPrayers = dayPrayers,
                    nextPrayer = nextPrayer,
                    previousPrayer = previousPrayer,
                    config = config,
                    modifier = GlanceModifier.fillMaxSize()
                )
            }
        }
    }
}
