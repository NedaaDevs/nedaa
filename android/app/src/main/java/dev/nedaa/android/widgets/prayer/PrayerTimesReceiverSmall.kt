package dev.nedaa.android.widgets.prayer

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

/**
 * Broadcast receiver for Small Prayer Times widget (2x2)
 * Uses WorkManager for exact prayer time updates
 */
class PrayerTimesReceiverSmall : GlanceAppWidgetReceiver() {

    companion object {
        private const val TAG = "PrayerTimesSmall"
    }

    override val glanceAppWidget: GlanceAppWidget = PrayerTimesWidgetSmall()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        Log.d(TAG, "Small widget enabled - scheduling updates")
        PrayerTimesWorker.scheduleUpdate(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        Log.d(TAG, "Small widget disabled")
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        Log.d(TAG, "onUpdate called for ${appWidgetIds.size} widgets")
        PrayerTimesWorker.scheduleUpdate(context)
    }
}
