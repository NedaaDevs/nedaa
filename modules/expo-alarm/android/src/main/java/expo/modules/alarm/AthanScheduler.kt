package expo.modules.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import org.json.JSONObject

class AthanScheduler(private val context: Context) {

    companion object {
        private const val TAG = "AthanScheduler"
        private const val PREFS_NAME = "nedaa_athan_scheduler"
        private const val KEY_SCHEDULED_ATHANS = "scheduled_athans"

        private val storeLock = Any()
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
            AlarmLogger.getInstance(context).w(TAG, "Cannot schedule exact alarms")
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

        persistAthan(id, triggerTimeMs, prayerId, soundName, title, stopLabel)
        AlarmLogger.getInstance(context).d(TAG, "Scheduled athan $id for $prayerId at $triggerTimeMs")
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
        removePersisted(id)
    }

    fun cancelAll(ids: List<String>) {
        for (id in ids) {
            cancelAthan(id)
        }
    }

    fun cancelAllPersisted() {
        val ids = synchronized(storeLock) { readStore().keys().asSequence().toList() }
        AlarmLogger.getInstance(context).d(TAG, "Cancelling ${ids.size} persisted athans")
        for (id in ids) {
            cancelAthan(id)
        }
        synchronized(storeLock) {
            prefs.edit().remove(KEY_SCHEDULED_ATHANS).apply()
        }
    }

    // Reschedule every persisted athan whose trigger is still in the future; drop stale or malformed entries.
    fun restoreAll() {
        val restorable = synchronized(storeLock) {
            val store = readStore()
            val now = System.currentTimeMillis()
            val survivors = mutableListOf<JSONObject>()
            var pruned = 0
            for (id in store.keys().asSequence().toList()) {
                val spec = store.optJSONObject(id)
                val triggerTimeMs = spec?.optLong("triggerTimeMs", 0L) ?: 0L
                val prayerId = spec?.optString("prayerId", "") ?: ""
                val soundName = spec?.optString("soundName", "") ?: ""
                if (spec == null || triggerTimeMs <= now || prayerId.isEmpty() || soundName.isEmpty()) {
                    store.remove(id)
                    pruned++
                } else {
                    survivors.add(spec)
                }
            }
            writeStore(store)
            AlarmLogger.getInstance(context).d(TAG, "Pruned $pruned stale athans, ${survivors.size} to restore")
            survivors
        }

        var restored = 0
        for (spec in restorable) {
            try {
                val ok = scheduleAthan(
                    spec.optString("id"),
                    spec.optLong("triggerTimeMs"),
                    spec.optString("prayerId"),
                    spec.optString("soundName"),
                    spec.optString("title"),
                    spec.optString("stopLabel", "Stop")
                )
                if (ok) restored++
            } catch (e: Exception) {
                AlarmLogger.getInstance(context).e(TAG, "Failed to restore athan ${spec.optString("id")}: ${e.message}")
            }
        }
        AlarmLogger.getInstance(context).d(TAG, "Restored $restored/${restorable.size} athans")
    }

    private fun persistAthan(
        id: String,
        triggerTimeMs: Long,
        prayerId: String,
        soundName: String,
        title: String,
        stopLabel: String
    ) {
        synchronized(storeLock) {
            val store = readStore()
            val spec = JSONObject().apply {
                put("id", id)
                put("triggerTimeMs", triggerTimeMs)
                put("prayerId", prayerId)
                put("soundName", soundName)
                put("title", title)
                put("stopLabel", stopLabel)
            }
            store.put(id, spec)
            writeStore(store)
        }
    }

    private fun removePersisted(id: String) {
        synchronized(storeLock) {
            val store = readStore()
            if (store.has(id)) {
                store.remove(id)
                writeStore(store)
            }
        }
    }

    private fun readStore(): JSONObject {
        val raw = prefs.getString(KEY_SCHEDULED_ATHANS, null) ?: return JSONObject()
        return try {
            JSONObject(raw)
        } catch (e: Exception) {
            AlarmLogger.getInstance(context).w(TAG, "Corrupt athan store, resetting: ${e.message}")
            JSONObject()
        }
    }

    private fun writeStore(store: JSONObject) {
        prefs.edit().putString(KEY_SCHEDULED_ATHANS, store.toString()).apply()
    }
}
