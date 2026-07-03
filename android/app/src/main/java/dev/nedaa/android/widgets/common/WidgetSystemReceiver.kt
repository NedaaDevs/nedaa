package dev.nedaa.android.widgets.common

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import dev.nedaa.android.widgets.athkar.AthkarWorker
import dev.nedaa.android.widgets.combined.PrayerAthkarWorker
import dev.nedaa.android.widgets.importantdays.ImportantDaysWorker
import dev.nedaa.android.widgets.prayer.PrayerTimesWorker
import dev.nedaa.android.widgets.qada.QadaWorker

/**
 * Re-renders and re-chains every widget after events that wipe scheduled work
 * (reboot) or invalidate rendered content (timezone/clock/locale change).
 */
class WidgetSystemReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.d("WidgetSystemReceiver", "Refreshing widgets for ${intent.action}")
        PrayerTimesWorker.scheduleUpdate(context, 0)
        PrayerAthkarWorker.scheduleUpdate(context, 0)
        AthkarWorker.schedulePeriodicUpdate(context)
        AthkarWorker.scheduleUpdate(context, 0)
        QadaWorker.schedulePeriodicUpdate(context)
        ImportantDaysWorker.scheduleUpdate(context, 0)
    }
}
