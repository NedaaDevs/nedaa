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

// Addressed by name so this module needs no reference to the app's widget classes.
private const val WIDGET_PREFS = "nedaa_widgets"
private const val KEY_LAST_RENDER = "widgetLastRenderedAt"

class ExpoWidgetsModule : Module() {

    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React context not available")

    private val activity: android.app.Activity?
        get() = appContext.currentActivity

    private val widgetReceiverMap = mapOf(
        "prayer_small" to "dev.nedaa.android.widgets.prayer.PrayerTimesReceiverSmall",
        "prayer_medium" to "dev.nedaa.android.widgets.prayer.PrayerTimesReceiverMedium",
        "prayer_large" to "dev.nedaa.android.widgets.prayer.PrayerTimesReceiverLarge",
        "athkar" to "dev.nedaa.android.widgets.athkar.AthkarReceiver",
        "athkar_medium" to "dev.nedaa.android.widgets.athkar.AthkarReceiverMedium",
        "qada" to "dev.nedaa.android.widgets.qada.QadaReceiver",
        "qada_medium" to "dev.nedaa.android.widgets.qada.QadaReceiverMedium",
        "prayer_athkar" to "dev.nedaa.android.widgets.combined.PrayerAthkarReceiver",
        "important_days" to "dev.nedaa.android.widgets.importantdays.ImportantDaysReceiver",
        "all_prayers" to "dev.nedaa.android.widgets.allprayers.AllPrayersReceiver",
        "suhoor_iftar" to "dev.nedaa.android.widgets.ramadan.SuhoorIftarReceiver",
        "hijri_date" to "dev.nedaa.android.widgets.hijri.HijriDateReceiver"
    )

    override fun definition() = ModuleDefinition {
        Name("ExpoWidgets")

        Function("isPinningSupported") {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val ctx = appContext.reactContext ?: return@Function false
                val appWidgetManager = AppWidgetManager.getInstance(ctx)
                return@Function appWidgetManager.isRequestPinAppWidgetSupported
            }
            return@Function false
        }

        Function("getAvailableWidgets") {
            return@Function widgetReceiverMap.keys.toList()
        }

        AsyncFunction("pinWidget") { widgetType: String ->
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                return@AsyncFunction false
            }

            val receiverClassName = widgetReceiverMap[widgetType]
                ?: return@AsyncFunction false

            val ctx = activity ?: context
            val appWidgetManager = AppWidgetManager.getInstance(ctx)
            if (!appWidgetManager.isRequestPinAppWidgetSupported) {
                return@AsyncFunction false
            }

            val provider = ComponentName(ctx.packageName, receiverClassName)
            return@AsyncFunction appWidgetManager.requestPinAppWidget(provider, null, null)
        }

        // Re-render every placed widget (JS calls this after data writes).
        // Broadcasts ACTION_APPWIDGET_UPDATE — this module can't reference the
        // app's receiver classes directly.
        AsyncFunction("refreshAllWidgets") {
            val ctx = context
            val mgr = AppWidgetManager.getInstance(ctx)
            widgetReceiverMap.values.forEach { className ->
                val provider = ComponentName(ctx.packageName, className)
                val ids = mgr.getAppWidgetIds(provider)
                if (ids.isNotEmpty()) {
                    val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                        .setComponent(provider)
                        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                    ctx.sendBroadcast(intent)
                }
            }
            return@AsyncFunction null
        }

        Function("getWidgetLastRenderedAt") {
            return@Function context
                .getSharedPreferences(WIDGET_PREFS, Context.MODE_PRIVATE)
                .getLong(KEY_LAST_RENDER, 0L)
        }

        Function("getPlacedWidgetCount") {
            val mgr = AppWidgetManager.getInstance(context)
            return@Function widgetReceiverMap.values.sumOf { className ->
                mgr.getAppWidgetIds(ComponentName(context.packageName, className)).size
            }
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
                    val act = activity
                    if (act != null) {
                        act.startActivity(intent)
                    } else {
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        context.startActivity(intent)
                    }
                    return@Function true
                }
            }
            return@Function false
        }
    }
}
