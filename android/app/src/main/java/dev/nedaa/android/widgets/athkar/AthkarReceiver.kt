package dev.nedaa.android.widgets.athkar

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import dev.nedaa.android.widgets.common.WidgetPlacement

/**
 * Broadcast receiver for Athkar Progress widget
 */
class AthkarReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = AthkarWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        AthkarWorker.scheduleUpdate(context, 0)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        // The medium size shares this chain.
        if (!WidgetPlacement.has(context, WidgetPlacement.Family.ATHKAR)) AthkarWorker.cancelUpdates(context)
    }
}
