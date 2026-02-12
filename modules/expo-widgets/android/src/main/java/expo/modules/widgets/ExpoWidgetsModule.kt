package expo.modules.widgets

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoWidgetsModule : Module() {

    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React context not available")

    private val widgetReceiverMap = mapOf(
        "prayer_small" to "dev.nedaa.android.widgets.prayer.PrayerTimesReceiverSmall",
        "prayer_medium" to "dev.nedaa.android.widgets.prayer.PrayerTimesReceiverMedium",
        "prayer_large" to "dev.nedaa.android.widgets.prayer.PrayerTimesReceiverLarge",
        "athkar" to "dev.nedaa.android.widgets.athkar.AthkarReceiver",
        "qada" to "dev.nedaa.android.widgets.qada.QadaReceiver",
        "prayer_athkar" to "dev.nedaa.android.widgets.combined.PrayerAthkarReceiver"
    )

    override fun definition() = ModuleDefinition {
        Name("ExpoWidgets")

        Function("isPinningSupported") {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val appWidgetManager = AppWidgetManager.getInstance(context)
                return@Function appWidgetManager.isRequestPinAppWidgetSupported
            }
            return@Function false
        }

        Function("getAvailableWidgets") {
            return@Function widgetReceiverMap.keys.toList()
        }

        Function("pinWidget") { widgetType: String ->
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                return@Function false
            }

            val receiverClassName = widgetReceiverMap[widgetType]
                ?: return@Function false

            val appWidgetManager = AppWidgetManager.getInstance(context)
            if (!appWidgetManager.isRequestPinAppWidgetSupported) {
                return@Function false
            }

            val provider = ComponentName(context.packageName, receiverClassName)
            return@Function appWidgetManager.requestPinAppWidget(provider, null, null)
        }
    }
}
