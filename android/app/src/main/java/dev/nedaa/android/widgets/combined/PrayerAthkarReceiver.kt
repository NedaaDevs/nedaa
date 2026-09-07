package dev.nedaa.android.widgets.combined

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import dev.nedaa.android.widgets.common.WidgetPlacement

/**
 * Broadcast receiver for Combined Prayer + Athkar widget
 */
class PrayerAthkarReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = PrayerAthkarWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        PrayerAthkarWorker.scheduleUpdate(context, 0)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        if (!WidgetPlacement.has(context, WidgetPlacement.Family.PRAYER_ATHKAR)) PrayerAthkarWorker.cancelUpdates(context)
    }
}
