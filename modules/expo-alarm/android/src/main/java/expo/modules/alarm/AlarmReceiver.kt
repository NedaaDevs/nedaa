package expo.modules.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AlarmReceiver : BroadcastReceiver() {

    companion object {
        const val EXTRA_ALARM_ID = "alarm_id"
        const val EXTRA_ALARM_TYPE = "alarm_type"
        const val EXTRA_ALARM_TITLE = "alarm_title"
        const val EXTRA_SOUND_NAME = "sound_name"
        private const val OVERLAP_DELAY_MS = 60_000L
        // Matches ALARM_DEFAULTS.STALE_ALARM_THRESHOLD_MS on the JS side.
        private const val STALE_PENDING_MS = 2 * 60 * 60 * 1000L
    }

    private fun isStillOpen(db: AlarmDatabase, pending: AlarmDatabase.PendingChallengeRecord): Boolean {
        val record = db.getAlarm(pending.alarmId) ?: return false
        val ageMs = System.currentTimeMillis() - (pending.timestamp * 1000).toLong()
        return !record.completed && ageMs < STALE_PENDING_MS
    }

    override fun onReceive(context: Context, intent: Intent) {
        val alarmId = intent.getStringExtra(EXTRA_ALARM_ID) ?: return
        AlarmLogger.getInstance(context).d("AlarmReceiver", "Alarm received: id=$alarmId")
        val alarmType = intent.getStringExtra(EXTRA_ALARM_TYPE) ?: "custom"
        val title = intent.getStringExtra(EXTRA_ALARM_TITLE) ?: "Alarm"
        val soundName = intent.getStringExtra(EXTRA_SOUND_NAME) ?: "beep"

        val db = AlarmDatabase.getInstance(context)
        // A delivery for a solved or removed alarm (a stale re-arm) must not ring.
        val record = db.getAlarm(alarmId)
        if (record == null || record.completed) {
            AlarmLogger.getInstance(context).w("AlarmReceiver", "Ignoring stale alarm: id=$alarmId found=${record != null}")
            return
        }
        // One alarm rings at a time: the open challenge owns the sound, the overlay and the
        // pending row, so a second alarm waits and rings once the first is solved.
        val pending = db.getPendingChallenge()
        if (AlarmService.isRunning && pending != null && pending.alarmId != alarmId &&
            isStillOpen(db, pending) &&
            AlarmScheduler(context).rearmUnsolvedAlarm(alarmId, OVERLAP_DELAY_MS)
        ) {
            AlarmLogger.getInstance(context).w("AlarmReceiver", "Deferred $alarmId behind ${pending.alarmId}")
            return
        }
        db.setPendingChallenge(alarmId, alarmType, title)

        AlarmService.start(context, alarmId, alarmType, title, soundName)
    }
}
