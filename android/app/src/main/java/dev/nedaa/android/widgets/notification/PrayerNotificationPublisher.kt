package dev.nedaa.android.widgets.notification

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.annotation.Keep
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.glance.appwidget.ExperimentalGlanceRemoteViewsApi
import androidx.glance.appwidget.GlanceRemoteViews
import dev.nedaa.android.R
import dev.nedaa.android.widgets.common.NedaaWidgetTheme
import dev.nedaa.android.widgets.common.WidgetConfig
import dev.nedaa.android.widgets.common.WidgetHeartbeat
import dev.nedaa.android.widgets.data.DayPrayers
import dev.nedaa.android.widgets.data.PrayerDataService
import dev.nedaa.android.widgets.prayer.PrayerTimesWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Publishes the optional prayer-times card that lives in the notification shade. */
@OptIn(ExperimentalGlanceRemoteViewsApi::class)
@Keep
object PrayerNotificationPublisher {
    const val CHANNEL_PERSISTENT = "nedaa_persistent"
    const val NOTIFICATION_ID = 0x4E44

    private const val TAG = "PrayerNotificationPublisher"
    private const val WIDTH_DP = 360

    // Android allows a collapsed custom view as little as 48dp and an expanded one 252dp.
    private const val COLLAPSED_HEIGHT_DP = 48
    private const val EXPANDED_HEIGHT_DP = 160

    private val PRAYER_WIDGET_RECEIVERS = listOf(
        "dev.nedaa.android.widgets.prayer.PrayerTimesReceiverSmall",
        "dev.nedaa.android.widgets.prayer.PrayerTimesReceiverMedium",
        "dev.nedaa.android.widgets.prayer.PrayerTimesReceiverLarge"
    )

    private val bridgeScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    suspend fun publish(context: Context) {
        if (!shouldPublish(isEnabled(context), hasNotificationPermission(context))) return

        val service = PrayerDataService(context)
        // Both states read one day so they cannot disagree once the last prayer has passed.
        val day = selectDay(
            service.getTodaysPrayerTimes(showSunrise = false),
            service.getTomorrowsPrayerTimes(showSunrise = false)
        )
        val nextPrayer = service.getNextPrayer(showSunrise = false)
        val config = WidgetConfig.get(context)
        val localizedContext = config.localizedContext(context)

        val collapsed = GlanceRemoteViews().compose(
            context = localizedContext,
            size = DpSize(WIDTH_DP.dp, COLLAPSED_HEIGHT_DP.dp),
            content = {
                NedaaWidgetTheme {
                    PrayerNotificationCompact(day, nextPrayer, config)
                }
            }
        ).remoteViews
        val expanded = GlanceRemoteViews().compose(
            context = localizedContext,
            size = DpSize(WIDTH_DP.dp, EXPANDED_HEIGHT_DP.dp),
            content = {
                NedaaWidgetTheme {
                    PrayerNotificationExpanded(day, nextPrayer, config)
                }
            }
        ).remoteViews

        ensureChannel(context)
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?: return
        val contentIntent = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_PERSISTENT)
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle(context.applicationInfo.loadLabel(context.packageManager))
            .setContentIntent(contentIntent)
            .setCustomContentView(collapsed)
            .setCustomBigContentView(expanded)
            .setStyle(NotificationCompat.DecoratedCustomViewStyle())
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(false)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()

        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
    }

    fun cancel(context: Context) {
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }

    /** Called by the Expo module without making the library depend on the app module. */
    @JvmStatic
    fun publishFromBridge(context: Context) {
        // The boundary chain is the only thing that repaints this card, and it is otherwise
        // started solely by a placed home-screen widget. Start it here so the card stays correct
        // for someone who wants the notification instead of a widget.
        PrayerTimesWorker.scheduleUpdate(context, 0)
        bridgeScope.launch {
            try {
                publish(context)
            } catch (error: Exception) {
                Log.e(TAG, "Unable to publish persistent notification", error)
            }
        }
    }

    /** Called by the Expo module without making the library depend on the app module. */
    @JvmStatic
    fun cancelFromBridge(context: Context) {
        cancel(context)
        // A placed widget still needs the chain; only the card's own use of it ends here.
        if (!hasPlacedPrayerWidget(context)) {
            PrayerTimesWorker.cancelUpdates(context)
        }
    }

    private fun hasPlacedPrayerWidget(context: Context): Boolean {
        val manager = AppWidgetManager.getInstance(context)
        return PRAYER_WIDGET_RECEIVERS.any { className ->
            manager.getAppWidgetIds(ComponentName(context.packageName, className)).isNotEmpty()
        }
    }

    private fun isEnabled(context: Context): Boolean = context
        .getSharedPreferences(WidgetHeartbeat.PREFS, Context.MODE_PRIVATE)
        .getBoolean(WidgetHeartbeat.KEY_PERSISTENT_NOTIFICATION_ENABLED, false)

    private fun hasNotificationPermission(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val channel = NotificationChannel(
            CHANNEL_PERSISTENT,
            context.applicationInfo.loadLabel(context.packageManager),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            setSound(null, null)
            enableVibration(false)
        }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    internal fun shouldPublish(enabled: Boolean, notificationPermissionGranted: Boolean): Boolean =
        enabled && notificationPermissionGranted

    internal fun selectDay(today: DayPrayers?, tomorrow: DayPrayers?): DayPrayers? =
        if (today?.getNextPrayer() == null) tomorrow ?: today else today
}
