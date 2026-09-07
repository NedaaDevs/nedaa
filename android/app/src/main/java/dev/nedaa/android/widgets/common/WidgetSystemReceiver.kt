package dev.nedaa.android.widgets.common

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import dev.nedaa.android.widgets.allprayers.AllPrayersWorker
import dev.nedaa.android.widgets.athkar.AthkarWorker
import dev.nedaa.android.widgets.combined.PrayerAthkarWorker
import dev.nedaa.android.widgets.common.WidgetPlacement.Family
import dev.nedaa.android.widgets.hijri.HijriDateWorker
import dev.nedaa.android.widgets.importantdays.ImportantDaysWorker
import dev.nedaa.android.widgets.notification.PrayerNotificationPublisher
import dev.nedaa.android.widgets.prayer.PrayerTimesWorker
import dev.nedaa.android.widgets.qada.QadaWorker
import dev.nedaa.android.widgets.ramadan.SuhoorIftarWorker

/**
 * Re-chains each widget family after events that wipe scheduled work (reboot) or
 * invalidate rendered content (timezone/clock/locale change). Only families with a
 * placed instance are scheduled: a device with no widgets schedules nothing.
 */
class WidgetSystemReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.d("WidgetSystemReceiver", "Refreshing widgets for ${intent.action}")
        // The shade card rides the prayer chain, so it keeps the chain alive without a widget.
        if (WidgetPlacement.has(context, Family.PRAYER) || PrayerNotificationPublisher.isEnabled(context)) {
            PrayerTimesWorker.scheduleUpdate(context, 0)
        }
        if (WidgetPlacement.has(context, Family.PRAYER_ATHKAR)) PrayerAthkarWorker.scheduleUpdate(context, 0)
        if (WidgetPlacement.has(context, Family.ATHKAR)) AthkarWorker.scheduleUpdate(context, 0)
        if (WidgetPlacement.has(context, Family.QADA)) QadaWorker.schedulePeriodicUpdate(context)
        if (WidgetPlacement.has(context, Family.IMPORTANT_DAYS)) ImportantDaysWorker.scheduleUpdate(context, 0)
        if (WidgetPlacement.has(context, Family.ALL_PRAYERS)) AllPrayersWorker.scheduleUpdate(context, 0)
        if (WidgetPlacement.has(context, Family.SUHOOR_IFTAR)) SuhoorIftarWorker.scheduleUpdate(context, 0)
        if (WidgetPlacement.has(context, Family.HIJRI_DATE)) HijriDateWorker.scheduleUpdate(context, 0)
    }
}
