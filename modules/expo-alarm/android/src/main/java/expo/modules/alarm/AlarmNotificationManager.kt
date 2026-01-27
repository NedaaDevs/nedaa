package expo.modules.alarm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat

class AlarmNotificationManager(private val context: Context) {

    companion object {
        const val CHANNEL_ID = "nedaa_alarm_channel"
        private const val CHANNEL_NAME = "Prayer Alarms"
        const val NOTIFICATION_ID = 9001
    }

    fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Alarm notifications for prayer times"
            setBypassDnd(true)
            enableVibration(false) // We handle vibration ourselves
            setSound(null, null)   // We handle audio ourselves via MediaPlayer
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            setShowBadge(true)
        }

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)
    }

    fun buildAlarmNotification(
        alarmId: String,
        alarmType: String,
        title: String
    ): NotificationCompat.Builder {
        createNotificationChannel()

        val deepLinkUri = Uri.parse("dev.nedaa.app://alarm?alarmId=$alarmId&alarmType=$alarmType")
        val fullScreenIntent = Intent(Intent.ACTION_VIEW, deepLinkUri).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
            setPackage(context.packageName)
        }

        val fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            alarmId.hashCode(),
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val contentIntent = PendingIntent.getActivity(
            context,
            alarmId.hashCode() + 1,
            fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val iconRes = context.resources.getIdentifier(
            "notification_icon", "drawable", context.packageName
        ).takeIf { it != 0 } ?: android.R.drawable.ic_lock_idle_alarm

        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(iconRes)
            .setContentTitle(title)
            .setContentText("Tap to dismiss alarm")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(contentIntent)
            .setSound(null)
    }

    fun cancelNotification() {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.cancel(NOTIFICATION_ID)
    }
}
