package expo.modules.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class AlarmReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "AlarmReceiver"
        const val EXTRA_ALARM_ID = "alarm_id"
        const val EXTRA_ALARM_TYPE = "alarm_type"
        const val EXTRA_ALARM_TITLE = "alarm_title"
        const val EXTRA_SOUND_NAME = "sound_name"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val alarmId = intent.getStringExtra(EXTRA_ALARM_ID) ?: return
        val alarmType = intent.getStringExtra(EXTRA_ALARM_TYPE) ?: "custom"
        val title = intent.getStringExtra(EXTRA_ALARM_TITLE) ?: "Alarm"
        val soundName = intent.getStringExtra(EXTRA_SOUND_NAME) ?: "beep"

        Log.d(TAG, "Alarm fired: id=$alarmId type=$alarmType")

        val db = AlarmDatabase.getInstance(context)
        db.setPendingChallenge(alarmId, alarmType, title)

        AlarmService.start(context, alarmId, alarmType, title, soundName)
    }
}
