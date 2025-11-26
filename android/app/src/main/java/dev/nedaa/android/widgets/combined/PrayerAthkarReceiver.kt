package dev.nedaa.android.widgets.combined

import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

/**
 * Broadcast receiver for Combined Prayer + Athkar widget
 */
class PrayerAthkarReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = PrayerAthkarWidget()
}
