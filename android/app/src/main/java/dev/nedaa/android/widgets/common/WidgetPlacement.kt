package dev.nedaa.android.widgets.common

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context

/**
 * Whether a widget family has at least one instance on a home screen. A family is the
 * set of receivers one worker repaints; the worker should run only while one is placed.
 */
object WidgetPlacement {

    enum class Family(val receivers: List<String>) {
        PRAYER(
            listOf(
                "dev.nedaa.android.widgets.prayer.PrayerTimesReceiverSmall",
                "dev.nedaa.android.widgets.prayer.PrayerTimesReceiverMedium",
                "dev.nedaa.android.widgets.prayer.PrayerTimesReceiverLarge",
            )
        ),
        PRAYER_ATHKAR(listOf("dev.nedaa.android.widgets.combined.PrayerAthkarReceiver")),
        ATHKAR(
            listOf(
                "dev.nedaa.android.widgets.athkar.AthkarReceiver",
                "dev.nedaa.android.widgets.athkar.AthkarReceiverMedium",
            )
        ),
        QADA(
            listOf(
                "dev.nedaa.android.widgets.qada.QadaReceiver",
                "dev.nedaa.android.widgets.qada.QadaReceiverMedium",
            )
        ),
        IMPORTANT_DAYS(listOf("dev.nedaa.android.widgets.importantdays.ImportantDaysReceiver")),
        ALL_PRAYERS(listOf("dev.nedaa.android.widgets.allprayers.AllPrayersReceiver")),
        SUHOOR_IFTAR(listOf("dev.nedaa.android.widgets.ramadan.SuhoorIftarReceiver")),
        HIJRI_DATE(listOf("dev.nedaa.android.widgets.hijri.HijriDateReceiver")),
    }

    fun has(context: Context, family: Family): Boolean {
        val manager = AppWidgetManager.getInstance(context)
        return anyPlaced(
            { manager.getAppWidgetIds(ComponentName(context.packageName, it)) },
            family.receivers,
        )
    }

    internal fun anyPlaced(placedIds: (String) -> IntArray, receivers: List<String>): Boolean =
        receivers.any { placedIds(it).isNotEmpty() }
}
