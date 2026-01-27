package expo.modules.alarm

import android.app.AlarmManager
import android.app.AlarmManager.AlarmClockInfo
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log

class AlarmScheduler(private val context: Context) {

    companion object {
        private const val TAG = "AlarmScheduler"
    }

    private val alarmManager: AlarmManager
        get() = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    fun canScheduleExactAlarms(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true
        }
    }

    fun scheduleAlarm(
        id: String,
        triggerTimeMs: Long,
        alarmType: String,
        title: String,
        soundName: String
    ): Boolean {
        if (!canScheduleExactAlarms()) {
            Log.w(TAG, "Cannot schedule exact alarms — permission denied")
            return false
        }

        val receiverIntent = Intent(context, AlarmReceiver::class.java).apply {
            putExtra(AlarmReceiver.EXTRA_ALARM_ID, id)
            putExtra(AlarmReceiver.EXTRA_ALARM_TYPE, alarmType)
            putExtra(AlarmReceiver.EXTRA_ALARM_TITLE, title)
            putExtra(AlarmReceiver.EXTRA_SOUND_NAME, soundName)
            data = Uri.parse("nedaa://alarm/$id")
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            receiverIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Build a show intent that opens the app when user taps alarm in Quick Settings
        val showIntent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("dev.nedaa.app://alarm?alarmId=$id&alarmType=$alarmType")
            component = ComponentName(context.packageName, "${context.packageName}.MainActivity")
        }
        val showPendingIntent = PendingIntent.getActivity(
            context,
            id.hashCode() + 100,
            showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val alarmClockInfo = AlarmClockInfo(triggerTimeMs, showPendingIntent)
        alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)

        Log.d(TAG, "Alarm scheduled: id=$id triggerMs=$triggerTimeMs")
        return true
    }

    fun cancelAlarm(id: String) {
        val receiverIntent = Intent(context, AlarmReceiver::class.java).apply {
            data = Uri.parse("nedaa://alarm/$id")
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            receiverIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(pendingIntent)
        pendingIntent.cancel()

        Log.d(TAG, "Alarm cancelled: id=$id")
    }

    fun cancelAll(ids: List<String>) {
        for (id in ids) {
            cancelAlarm(id)
        }
        Log.d(TAG, "Cancelled ${ids.size} alarms")
    }
}
