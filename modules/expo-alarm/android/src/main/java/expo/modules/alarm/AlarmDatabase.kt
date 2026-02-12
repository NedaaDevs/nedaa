package expo.modules.alarm

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class AlarmDatabase private constructor(private val context: Context) :
    SQLiteOpenHelper(context, DB_NAME, null, DB_VERSION) {

    companion object {
        private const val DB_NAME = "alarm_state.db"
        private const val DB_VERSION = 4
        const val SNOOZE_MINUTES = 5
        const val MAX_SNOOZES = 3

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
                snooze_count INTEGER DEFAULT 0,
                created_at REAL NOT NULL
            )
        """)

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS alarm_settings (
                alarm_type TEXT PRIMARY KEY,
                enabled INTEGER DEFAULT 0,
                sound TEXT DEFAULT 'beep',
                volume REAL DEFAULT 1.0,
                challenge_type TEXT DEFAULT 'tap',
                challenge_difficulty TEXT DEFAULT 'easy',
                challenge_count INTEGER DEFAULT 1,
                gentle_wakeup_enabled INTEGER DEFAULT 0,
                gentle_wakeup_duration INTEGER DEFAULT 3,
                vibration_enabled INTEGER DEFAULT 1,
                vibration_pattern TEXT DEFAULT 'default',
                snooze_enabled INTEGER DEFAULT 1,
                snooze_max_count INTEGER DEFAULT 3,
                snooze_duration INTEGER DEFAULT 5
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

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS completed_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alarm_id TEXT NOT NULL,
                alarm_type TEXT NOT NULL,
                title TEXT NOT NULL,
                completed_at REAL NOT NULL
            )
        """)

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS snooze_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_alarm_id TEXT NOT NULL,
                snooze_alarm_id TEXT NOT NULL,
                alarm_type TEXT NOT NULL,
                title TEXT NOT NULL,
                snooze_count INTEGER NOT NULL,
                snooze_end_time REAL NOT NULL,
                snoozed_at REAL NOT NULL
            )
        """)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            db.execSQL("""
                CREATE TABLE IF NOT EXISTS completed_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    alarm_id TEXT NOT NULL,
                    alarm_type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    completed_at REAL NOT NULL
                )
            """)
        }
        if (oldVersion < 3) {
            // Add snooze_count column to alarms table
            try {
                db.execSQL("ALTER TABLE alarms ADD COLUMN snooze_count INTEGER DEFAULT 0")
            } catch (_: Exception) {}

            db.execSQL("""
                CREATE TABLE IF NOT EXISTS snooze_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    original_alarm_id TEXT NOT NULL,
                    snooze_alarm_id TEXT NOT NULL,
                    alarm_type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    snooze_count INTEGER NOT NULL,
                    snooze_end_time REAL NOT NULL,
                    snoozed_at REAL NOT NULL
                )
            """)
        }
        if (oldVersion < 4) {
            db.execSQL("""
                CREATE TABLE IF NOT EXISTS alarm_settings (
                    alarm_type TEXT PRIMARY KEY,
                    enabled INTEGER DEFAULT 0,
                    sound TEXT DEFAULT 'beep',
                    volume REAL DEFAULT 1.0,
                    challenge_type TEXT DEFAULT 'tap',
                    challenge_difficulty TEXT DEFAULT 'easy',
                    challenge_count INTEGER DEFAULT 1,
                    gentle_wakeup_enabled INTEGER DEFAULT 0,
                    gentle_wakeup_duration INTEGER DEFAULT 3,
                    vibration_enabled INTEGER DEFAULT 1,
                    vibration_pattern TEXT DEFAULT 'default',
                    snooze_enabled INTEGER DEFAULT 1,
                    snooze_max_count INTEGER DEFAULT 3,
                    snooze_duration INTEGER DEFAULT 5
                )
            """)
        }
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
        isBackup: Boolean = false,
        snoozeCount: Int = 0
    ) {
        val values = ContentValues().apply {
            put("id", id)
            put("alarm_type", alarmType)
            put("title", title)
            put("trigger_time", triggerTime)
            put("completed", 0)
            put("is_backup", if (isBackup) 1 else 0)
            put("snooze_count", snoozeCount)
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
        val isBackup: Boolean,
        val snoozeCount: Int
    )

    fun getAlarm(id: String): AlarmRecord? {
        val cursor = readableDatabase.rawQuery(
            "SELECT id, alarm_type, title, trigger_time, completed, is_backup, snooze_count FROM alarms WHERE id = ?",
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
                    isBackup = it.getInt(5) == 1,
                    snoozeCount = it.getInt(6)
                )
            } else null
        }
    }

    fun getSnoozeCount(alarmId: String): Int {
        val alarm = getAlarm(alarmId)
        return alarm?.snoozeCount ?: 0
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
            "SELECT id, alarm_type, title, trigger_time, completed, is_backup, snooze_count FROM alarms WHERE completed = 0 AND is_backup = 0",
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
                        isBackup = it.getInt(5) == 1,
                        snoozeCount = it.getInt(6)
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


    fun clearAllCompleted() {
        val values = ContentValues().apply { put("completed", 0) }
        val now = System.currentTimeMillis().toDouble()
        writableDatabase.update("alarms", values, "trigger_time > ? AND is_backup = 0", arrayOf(now.toString()))
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
        val db = writableDatabase
        db.beginTransaction()
        try {
            db.delete("pending_challenge", null, null)
            val values = ContentValues().apply {
                put("id", 1)
                put("alarm_id", alarmId)
                put("alarm_type", alarmType)
                put("title", title)
                put("timestamp", System.currentTimeMillis() / 1000.0)
            }
            db.insert("pending_challenge", null, values)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
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
        val db = writableDatabase
        db.beginTransaction()
        try {
            db.delete("bypass_state", null, null)
            val values = ContentValues().apply {
                put("id", 1)
                put("alarm_id", alarmId)
                put("alarm_type", alarmType)
                put("title", title)
                put("activated_at", System.currentTimeMillis() / 1000.0)
            }
            db.insert("bypass_state", null, values)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
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

    // -- Completed Queue (for JS to process on app open) --

    fun addToCompletedQueue(alarmId: String, alarmType: String, title: String) {
        val values = ContentValues().apply {
            put("alarm_id", alarmId)
            put("alarm_type", alarmType)
            put("title", title)
            put("completed_at", System.currentTimeMillis() / 1000.0)
        }
        writableDatabase.insert("completed_queue", null, values)
    }

    data class CompletedAlarmRecord(
        val alarmId: String,
        val alarmType: String,
        val title: String,
        val completedAt: Double
    )

    fun getCompletedQueue(): List<CompletedAlarmRecord> {
        val queue = mutableListOf<CompletedAlarmRecord>()
        val cursor = readableDatabase.rawQuery(
            "SELECT alarm_id, alarm_type, title, completed_at FROM completed_queue ORDER BY completed_at ASC",
            null
        )
        cursor.use {
            while (it.moveToNext()) {
                queue.add(
                    CompletedAlarmRecord(
                        alarmId = it.getString(0),
                        alarmType = it.getString(1),
                        title = it.getString(2),
                        completedAt = it.getDouble(3)
                    )
                )
            }
        }
        return queue
    }

    fun clearCompletedQueue() {
        writableDatabase.delete("completed_queue", null, null)
    }

    // -- Snooze Queue (for JS to process on app open) --

    fun addToSnoozeQueue(
        originalAlarmId: String,
        snoozeAlarmId: String,
        alarmType: String,
        title: String,
        snoozeCount: Int,
        snoozeEndTime: Double
    ) {
        val values = ContentValues().apply {
            put("original_alarm_id", originalAlarmId)
            put("snooze_alarm_id", snoozeAlarmId)
            put("alarm_type", alarmType)
            put("title", title)
            put("snooze_count", snoozeCount)
            put("snooze_end_time", snoozeEndTime)
            put("snoozed_at", System.currentTimeMillis() / 1000.0)
        }
        writableDatabase.insert("snooze_queue", null, values)
    }

    data class SnoozeQueueRecord(
        val originalAlarmId: String,
        val snoozeAlarmId: String,
        val alarmType: String,
        val title: String,
        val snoozeCount: Int,
        val snoozeEndTime: Double
    )

    fun getSnoozeQueue(): List<SnoozeQueueRecord> {
        val queue = mutableListOf<SnoozeQueueRecord>()
        val cursor = readableDatabase.rawQuery(
            "SELECT original_alarm_id, snooze_alarm_id, alarm_type, title, snooze_count, snooze_end_time FROM snooze_queue ORDER BY snoozed_at ASC",
            null
        )
        cursor.use {
            while (it.moveToNext()) {
                queue.add(
                    SnoozeQueueRecord(
                        originalAlarmId = it.getString(0),
                        snoozeAlarmId = it.getString(1),
                        alarmType = it.getString(2),
                        title = it.getString(3),
                        snoozeCount = it.getInt(4),
                        snoozeEndTime = it.getDouble(5)
                    )
                )
            }
        }
        return queue
    }

    fun clearSnoozeQueue() {
        writableDatabase.delete("snooze_queue", null, null)
    }

    // -- Alarm Settings --

    data class AlarmSettingsRecord(
        val alarmType: String,
        val enabled: Boolean,
        val sound: String,
        val volume: Float,
        val challengeType: String,
        val challengeDifficulty: String,
        val challengeCount: Int,
        val gentleWakeUpEnabled: Boolean,
        val gentleWakeUpDuration: Int,
        val vibrationEnabled: Boolean,
        val vibrationPattern: String,
        val snoozeEnabled: Boolean,
        val snoozeMaxCount: Int,
        val snoozeDuration: Int
    )

    fun getAlarmSettings(alarmType: String): AlarmSettingsRecord {
        val cursor = readableDatabase.rawQuery(
            """SELECT alarm_type, enabled, sound, volume, challenge_type, challenge_difficulty,
               challenge_count, gentle_wakeup_enabled, gentle_wakeup_duration, vibration_enabled,
               vibration_pattern, snooze_enabled, snooze_max_count, snooze_duration
               FROM alarm_settings WHERE alarm_type = ?""",
            arrayOf(alarmType)
        )
        return cursor.use {
            if (it.moveToFirst()) {
                AlarmSettingsRecord(
                    alarmType = it.getString(0),
                    enabled = it.getInt(1) == 1,
                    sound = it.getString(2),
                    volume = it.getFloat(3),
                    challengeType = it.getString(4),
                    challengeDifficulty = it.getString(5),
                    challengeCount = it.getInt(6),
                    gentleWakeUpEnabled = it.getInt(7) == 1,
                    gentleWakeUpDuration = it.getInt(8),
                    vibrationEnabled = it.getInt(9) == 1,
                    vibrationPattern = it.getString(10),
                    snoozeEnabled = it.getInt(11) == 1,
                    snoozeMaxCount = it.getInt(12),
                    snoozeDuration = it.getInt(13)
                )
            } else {
                // Return defaults
                AlarmSettingsRecord(
                    alarmType = alarmType,
                    enabled = false,
                    sound = "beep",
                    volume = 1.0f,
                    challengeType = "tap",
                    challengeDifficulty = "easy",
                    challengeCount = 1,
                    gentleWakeUpEnabled = false,
                    gentleWakeUpDuration = 3,
                    vibrationEnabled = true,
                    vibrationPattern = "default",
                    snoozeEnabled = true,
                    snoozeMaxCount = 3,
                    snoozeDuration = 5
                )
            }
        }
    }

    fun saveAlarmSettings(settings: AlarmSettingsRecord) {
        val values = ContentValues().apply {
            put("alarm_type", settings.alarmType)
            put("enabled", if (settings.enabled) 1 else 0)
            put("sound", settings.sound)
            put("volume", settings.volume)
            put("challenge_type", settings.challengeType)
            put("challenge_difficulty", settings.challengeDifficulty)
            put("challenge_count", settings.challengeCount)
            put("gentle_wakeup_enabled", if (settings.gentleWakeUpEnabled) 1 else 0)
            put("gentle_wakeup_duration", settings.gentleWakeUpDuration)
            put("vibration_enabled", if (settings.vibrationEnabled) 1 else 0)
            put("vibration_pattern", settings.vibrationPattern)
            put("snooze_enabled", if (settings.snoozeEnabled) 1 else 0)
            put("snooze_max_count", settings.snoozeMaxCount)
            put("snooze_duration", settings.snoozeDuration)
        }
        writableDatabase.insertWithOnConflict("alarm_settings", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun updateAlarmSetting(alarmType: String, key: String, value: Any) {
        // First ensure row exists
        val settings = getAlarmSettings(alarmType)
        if (settings.alarmType != alarmType) {
            // Insert default row first
            saveAlarmSettings(settings.copy(alarmType = alarmType))
        }

        val values = ContentValues().apply {
            when (value) {
                is Boolean -> put(key, if (value) 1 else 0)
                is Int -> put(key, value)
                is Float -> put(key, value)
                is Double -> put(key, value.toFloat())
                is String -> put(key, value)
                else -> put(key, value.toString())
            }
        }
        writableDatabase.update("alarm_settings", values, "alarm_type = ?", arrayOf(alarmType))
    }

    fun isAlarmEnabled(alarmType: String): Boolean {
        return getAlarmSettings(alarmType).enabled
    }

    fun getChallengeConfig(alarmType: String): Triple<String, String, Int> {
        val settings = getAlarmSettings(alarmType)
        return Triple(settings.challengeType, settings.challengeDifficulty, settings.challengeCount)
    }

    fun getSnoozeConfig(alarmType: String): Triple<Boolean, Int, Int> {
        val settings = getAlarmSettings(alarmType)
        return Triple(settings.snoozeEnabled, settings.snoozeMaxCount, settings.snoozeDuration)
    }

    fun getVibrationConfig(alarmType: String): Pair<Boolean, String> {
        val settings = getAlarmSettings(alarmType)
        return Pair(settings.vibrationEnabled, settings.vibrationPattern)
    }
}
