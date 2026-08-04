package expo.modules.alarm

import android.app.AlarmManager
import android.app.AlarmManager.AlarmClockInfo
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

class AlarmScheduler(private val context: Context) {

    companion object {
        const val REARM_DELAY_MS = 15_000L
    }

    private val alarmManager: AlarmManager
        get() = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    /**
     * Rings an alarm again shortly after its challenge was abandoned.
     *
     * The alarm services are START_NOT_STICKY, so swiping the app out of recents destroys them
     * and nothing brings them back — the alarm would disappear with the challenge unsolved.
     * Rescheduling the same id restores it; a completed alarm is left alone.
     */
    fun rearmUnsolvedAlarm(alarmId: String, delayMs: Long = REARM_DELAY_MS): Boolean {
        if (alarmId.isEmpty()) return false

        val db = AlarmDatabase.getInstance(context)
        val record = db.getAlarm(alarmId) ?: return false
        if (record.completed) return false

        val sound = db.getAlarmSettings(record.alarmType).sound.ifEmpty { "beep" }
        val armed = scheduleAlarm(
            id = alarmId,
            triggerTimeMs = System.currentTimeMillis() + delayMs,
            alarmType = record.alarmType,
            title = record.title,
            soundName = sound,
            snoozeCount = record.snoozeCount
        )
        AlarmLogger.getInstance(context).w(
            "AlarmScheduler",
            "Challenge abandoned, alarm re-armed in ${delayMs}ms: id=$alarmId armed=$armed"
        )
        return armed
    }

    private fun stableRequestCode(id: String): Int {
        var h = 0
        for (c in id) {
            h = 31 * h + c.code
            h = h xor (h ushr 16)
        }
        return h and 0x7FFFFFFF
    }

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
        soundName: String,
        snoozeCount: Int = 0
    ): Boolean {
        if (!canScheduleExactAlarms()) {
            AlarmLogger.getInstance(context).e("AlarmScheduler", "Exact alarm permission denied — cannot schedule id=$id type=$alarmType")
            return false
        }

        // Save to database
        val db = AlarmDatabase.getInstance(context)
        db.saveAlarm(id, alarmType, title, triggerTimeMs.toDouble(), isBackup = false, snoozeCount = snoozeCount)

        val receiverIntent = Intent(context, AlarmReceiver::class.java).apply {
            putExtra(AlarmReceiver.EXTRA_ALARM_ID, id)
            putExtra(AlarmReceiver.EXTRA_ALARM_TYPE, alarmType)
            putExtra(AlarmReceiver.EXTRA_ALARM_TITLE, title)
            putExtra(AlarmReceiver.EXTRA_SOUND_NAME, soundName)
            data = Uri.parse("nedaa://alarm/$id")
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            stableRequestCode(id),
            receiverIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val showIntent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("dev.nedaa.app://alarm?alarmId=$id&alarmType=$alarmType")
            component = ComponentName(context.packageName, "${context.packageName}.MainActivity")
        }
        val showPendingIntent = PendingIntent.getActivity(
            context,
            stableRequestCode(id) + 100,
            showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val alarmClockInfo = AlarmClockInfo(triggerTimeMs, showPendingIntent)
        alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
        AlarmLogger.getInstance(context).d("AlarmScheduler", "Alarm scheduled: id=$id triggerTime=$triggerTimeMs")

        return true
    }

    fun cancelAlarm(id: String) {
        val receiverIntent = Intent(context, AlarmReceiver::class.java).apply {
            data = Uri.parse("nedaa://alarm/$id")
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            stableRequestCode(id),
            receiverIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(pendingIntent)
        pendingIntent.cancel()
        AlarmLogger.getInstance(context).d("AlarmScheduler", "Alarm cancelled: id=$id")
    }

    fun cancelAll(ids: List<String>) {
        for (id in ids) {
            cancelAlarm(id)
        }
    }
}
