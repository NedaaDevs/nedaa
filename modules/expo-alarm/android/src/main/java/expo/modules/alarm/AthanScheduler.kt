package expo.modules.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.util.Log

class AthanScheduler(private val context: Context) {

    companion object {
        private const val TAG = "AthanScheduler"
        private const val PREFS_NAME = "nedaa_athan_scheduler"
        private const val KEY_SCHEDULED_IDS = "scheduled_athan_ids"
    }

    private val alarmManager: AlarmManager
        get() = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    private val prefs: SharedPreferences
        get() = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun scheduleAthan(
        id: String,
        triggerTimeMs: Long,
        prayerId: String,
        soundName: String,
        title: String,
        stopLabel: String
    ): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
            Log.w(TAG, "Cannot schedule exact alarms")
            return false
        }

        val intent = Intent(context, AthanReceiver::class.java).apply {
            putExtra(AthanReceiver.EXTRA_ATHAN_ID, id)
            putExtra(AthanReceiver.EXTRA_PRAYER_ID, prayerId)
            putExtra(AthanReceiver.EXTRA_SOUND_NAME, soundName)
            putExtra(AthanReceiver.EXTRA_TITLE, title)
            putExtra(AthanReceiver.EXTRA_STOP_LABEL, stopLabel)
            data = Uri.parse("nedaa://athan/$id")
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            triggerTimeMs,
            pendingIntent
        )

        persistId(id)
        Log.d(TAG, "Scheduled athan $id for $prayerId at $triggerTimeMs")
        return true
    }

    fun cancelAthan(id: String) {
        val intent = Intent(context, AthanReceiver::class.java).apply {
            data = Uri.parse("nedaa://athan/$id")
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
        }
        removeId(id)
    }

    fun cancelAll(ids: List<String>) {
        for (id in ids) {
            cancelAthan(id)
        }
    }

    fun cancelAllPersisted() {
        val ids = getPersistedIds()
        Log.d(TAG, "Cancelling ${ids.size} persisted athans")
        for (id in ids) {
            cancelAthan(id)
        }
        clearPersistedIds()
    }

    private fun persistId(id: String) {
        val ids = getPersistedIds().toMutableSet()
        ids.add(id)
        prefs.edit().putStringSet(KEY_SCHEDULED_IDS, ids).apply()
    }

    private fun removeId(id: String) {
        val ids = getPersistedIds().toMutableSet()
        ids.remove(id)
        prefs.edit().putStringSet(KEY_SCHEDULED_IDS, ids).apply()
    }

    private fun getPersistedIds(): Set<String> {
        return prefs.getStringSet(KEY_SCHEDULED_IDS, emptySet()) ?: emptySet()
    }

    private fun clearPersistedIds() {
        prefs.edit().remove(KEY_SCHEDULED_IDS).apply()
    }
}
