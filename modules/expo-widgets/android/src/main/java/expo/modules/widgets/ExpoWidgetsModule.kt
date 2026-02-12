package expo.modules.widgets

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
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
        "athkar_medium" to "dev.nedaa.android.widgets.athkar.AthkarReceiverMedium",
        "qada" to "dev.nedaa.android.widgets.qada.QadaReceiver",
        "qada_medium" to "dev.nedaa.android.widgets.qada.QadaReceiverMedium",
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

        Function("isBatteryOptimizationDisabled") {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
                return@Function pm.isIgnoringBatteryOptimizations(context.packageName)
            }
            return@Function true
        }

        Function("requestDisableBatteryOptimization") {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
                if (!pm.isIgnoringBatteryOptimizations(context.packageName)) {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                    intent.data = Uri.parse("package:${context.packageName}")
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                    return@Function true
                }
            }
            return@Function false
        }
    }
}
