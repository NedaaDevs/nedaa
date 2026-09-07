package dev.nedaa.android.widgets.qada

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import dev.nedaa.android.widgets.common.WidgetPlacement

/**
 * Broadcast receiver for Qada widget
 */
class QadaReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = QadaWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        QadaWorker.schedulePeriodicUpdate(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        // The medium size shares this periodic job.
        if (!WidgetPlacement.has(context, WidgetPlacement.Family.QADA)) QadaWorker.cancelUpdates(context)
    }
}
