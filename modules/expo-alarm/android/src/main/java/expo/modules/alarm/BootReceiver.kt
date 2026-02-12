package expo.modules.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) {
            return
        }

        Log.d(TAG, "Boot completed — rescheduling alarms")

        val db = AlarmDatabase.getInstance(context)
        val scheduler = AlarmScheduler(context)
        val alarms = db.getAllPendingAlarms()
        val now = System.currentTimeMillis()

        var rescheduled = 0
        for (alarm in alarms) {
            try {
                val triggerMs = alarm.triggerTime.toLong()
                if (triggerMs > now) {
                    val settings = db.getAlarmSettings(alarm.alarmType)
                    scheduler.scheduleAlarm(alarm.id, triggerMs, alarm.alarmType, alarm.title, settings.sound)
                    rescheduled++
                } else {
                    Log.d(TAG, "Skipping expired alarm: ${alarm.id}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to reschedule alarm ${alarm.id}: ${e.message}")
            }
        }

        Log.d(TAG, "Rescheduled $rescheduled/${alarms.size} alarms after boot")
    }
}
