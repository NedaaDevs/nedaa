package expo.modules.alarm

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class AlarmDatabase private constructor(context: Context) :
    SQLiteOpenHelper(context, DB_NAME, null, DB_VERSION) {

    companion object {
        private const val DB_NAME = "alarm_state.db"
        private const val DB_VERSION = 1

        @Volatile
        private var instance: AlarmDatabase? = null

        fun getInstance(context: Context): AlarmDatabase {
            return instance ?: synchronized(this) {
                instance ?: AlarmDatabase(context.applicationContext).also { instance = it }
            }
        }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS alarms (
                id TEXT PRIMARY KEY,
                alarm_type TEXT NOT NULL,
                title TEXT NOT NULL,
                trigger_time REAL NOT NULL,
                completed INTEGER DEFAULT 0,
                is_backup INTEGER DEFAULT 0,
                created_at REAL NOT NULL
            )
        """)

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS pending_challenge (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                alarm_id TEXT NOT NULL,
                alarm_type TEXT NOT NULL,
                title TEXT NOT NULL,
                timestamp REAL NOT NULL
            )
        """)

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS bypass_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                alarm_id TEXT NOT NULL,
                alarm_type TEXT NOT NULL,
                title TEXT NOT NULL,
                activated_at REAL NOT NULL
            )
        """)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // Future migrations go here
    }

    override fun onOpen(db: SQLiteDatabase) {
        super.onOpen(db)
        db.enableWriteAheadLogging()
    }

    // -- Alarms --

    fun saveAlarm(
        id: String,
        alarmType: String,
        title: String,
        triggerTime: Double,
        isBackup: Boolean = false
    ) {
        val values = ContentValues().apply {
            put("id", id)
            put("alarm_type", alarmType)
            put("title", title)
            put("trigger_time", triggerTime)
            put("completed", 0)
            put("is_backup", if (isBackup) 1 else 0)
            put("created_at", System.currentTimeMillis().toDouble())
        }
        writableDatabase.insertWithOnConflict("alarms", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    data class AlarmRecord(
        val id: String,
        val alarmType: String,
        val title: String,
        val triggerTime: Double,
        val completed: Boolean,
        val isBackup: Boolean
    )

    fun getAlarm(id: String): AlarmRecord? {
        val cursor = readableDatabase.rawQuery(
            "SELECT id, alarm_type, title, trigger_time, completed, is_backup FROM alarms WHERE id = ?",
            arrayOf(id)
        )
        return cursor.use {
            if (it.moveToFirst()) {
                AlarmRecord(
                    id = it.getString(0),
                    alarmType = it.getString(1),
                    title = it.getString(2),
                    triggerTime = it.getDouble(3),
                    completed = it.getInt(4) == 1,
                    isBackup = it.getInt(5) == 1
                )
            } else null
        }
    }

    fun getAllAlarmIds(): List<String> {
        val ids = mutableListOf<String>()
        val cursor = readableDatabase.rawQuery(
            "SELECT id FROM alarms WHERE is_backup = 0", null
        )
        cursor.use {
            while (it.moveToNext()) {
                ids.add(it.getString(0))
            }
        }
        return ids
    }

    fun getAllPendingAlarms(): List<AlarmRecord> {
        val alarms = mutableListOf<AlarmRecord>()
        val cursor = readableDatabase.rawQuery(
            "SELECT id, alarm_type, title, trigger_time, completed, is_backup FROM alarms WHERE completed = 0 AND is_backup = 0",
            null
        )
        cursor.use {
            while (it.moveToNext()) {
                alarms.add(
                    AlarmRecord(
                        id = it.getString(0),
                        alarmType = it.getString(1),
                        title = it.getString(2),
                        triggerTime = it.getDouble(3),
                        completed = it.getInt(4) == 1,
                        isBackup = it.getInt(5) == 1
                    )
                )
            }
        }
        return alarms
    }

    fun markCompleted(id: String) {
        val values = ContentValues().apply { put("completed", 1) }
        writableDatabase.update("alarms", values, "id = ?", arrayOf(id))
    }

    fun deleteAlarm(id: String) {
        writableDatabase.delete("alarms", "id = ?", arrayOf(id))
    }

    fun deleteAllAlarms() {
        writableDatabase.delete("alarms", null, null)
    }

    fun deleteAllBackups() {
        writableDatabase.delete("alarms", "is_backup = 1", null)
    }

    fun clearAllCompleted() {
        val values = ContentValues().apply { put("completed", 0) }
        writableDatabase.update("alarms", values, null, null)
    }

    fun getNextAlarmTime(): Double? {
        val cursor = readableDatabase.rawQuery(
            "SELECT MIN(trigger_time) FROM alarms WHERE completed = 0 AND is_backup = 0",
            null
        )
        return cursor.use {
            if (it.moveToFirst() && !it.isNull(0)) it.getDouble(0) else null
        }
    }

    // -- Pending Challenge --

    fun setPendingChallenge(alarmId: String, alarmType: String, title: String) {
        writableDatabase.delete("pending_challenge", null, null)
        val values = ContentValues().apply {
            put("id", 1)
            put("alarm_id", alarmId)
            put("alarm_type", alarmType)
            put("title", title)
            put("timestamp", System.currentTimeMillis() / 1000.0)
        }
        writableDatabase.insert("pending_challenge", null, values)
    }

    data class PendingChallengeRecord(
        val alarmId: String,
        val alarmType: String,
        val title: String,
        val timestamp: Double
    )

    fun getPendingChallenge(): PendingChallengeRecord? {
        val cursor = readableDatabase.rawQuery(
            "SELECT alarm_id, alarm_type, title, timestamp FROM pending_challenge WHERE id = 1",
            null
        )
        return cursor.use {
            if (it.moveToFirst()) {
                PendingChallengeRecord(
                    alarmId = it.getString(0),
                    alarmType = it.getString(1),
                    title = it.getString(2),
                    timestamp = it.getDouble(3)
                )
            } else null
        }
    }

    fun clearPendingChallenge() {
        val pending = getPendingChallenge()
        if (pending != null) {
            markCompleted(pending.alarmId)
        }
        writableDatabase.delete("pending_challenge", null, null)
    }

    // -- Bypass State --

    fun setBypassState(alarmId: String, alarmType: String, title: String) {
        writableDatabase.delete("bypass_state", null, null)
        val values = ContentValues().apply {
            put("id", 1)
            put("alarm_id", alarmId)
            put("alarm_type", alarmType)
            put("title", title)
            put("activated_at", System.currentTimeMillis() / 1000.0)
        }
        writableDatabase.insert("bypass_state", null, values)
    }

    data class BypassStateRecord(
        val alarmId: String,
        val alarmType: String,
        val title: String,
        val activatedAt: Double
    )

    fun getBypassState(): BypassStateRecord? {
        val cursor = readableDatabase.rawQuery(
            "SELECT alarm_id, alarm_type, title, activated_at FROM bypass_state WHERE id = 1",
            null
        )
        return cursor.use {
            if (it.moveToFirst()) {
                BypassStateRecord(
                    alarmId = it.getString(0),
                    alarmType = it.getString(1),
                    title = it.getString(2),
                    activatedAt = it.getDouble(3)
                )
            } else null
        }
    }

    fun clearBypassState() {
        writableDatabase.delete("bypass_state", null, null)
    }
}
