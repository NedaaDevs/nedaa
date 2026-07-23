package expo.modules.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) {
            return
        }

        val appContext = context.applicationContext
        val pendingResult = goAsync()
        Thread {
            try {
                AlarmLogger.getInstance(appContext).d(TAG, "Restoring schedules after $action")
                restoreAlarms(appContext)
                restoreAthans(appContext)
            } finally {
                pendingResult.finish()
            }
        }.start()
    }

    private fun restoreAlarms(context: Context) {
        val logger = AlarmLogger.getInstance(context)
        try {
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
                        scheduler.scheduleAlarm(alarm.id, triggerMs, alarm.alarmType, alarm.title, settings.sound, alarm.snoozeCount)
                        rescheduled++
                    } else {
                        logger.d(TAG, "Skipping expired alarm: ${alarm.id}")
                    }
                } catch (e: Exception) {
                    logger.e(TAG, "Failed to reschedule alarm ${alarm.id}", e)
                }
            }
            logger.d(TAG, "Rescheduled $rescheduled/${alarms.size} alarms")
        } catch (e: Exception) {
            logger.e(TAG, "Alarm restore failed", e)
        }
    }

    private fun restoreAthans(context: Context) {
        val logger = AlarmLogger.getInstance(context)
        try {
            AthanScheduler(context).restoreAll()
        } catch (e: Exception) {
            logger.e(TAG, "Athan restore failed", e)
        }
    }
}
