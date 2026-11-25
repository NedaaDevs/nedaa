package expo.modules.alarm

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class AlarmDatabase private constructor(private val context: Context) :
    SQLiteOpenHelper(context, DB_NAME, null, AlarmMigrations.LATEST_VERSION) {

    companion object {
        private const val DB_NAME = "alarm_state.db"
        // How a challenge ended; only a solved one is a wake-up.
        const val OUTCOME_SOLVED = "solved"
        const val OUTCOME_ABANDONED = "abandoned"
        const val OUTCOME_STOPPED = "stopped"
        const val SNOOZE_MINUTES = 5
        const val MAX_SNOOZES = 3

        @Volatile
        private var instance: AlarmDatabase? = null

        fun getInstance(context: Context): AlarmDatabase {
            return instance ?: synchronized(this) {
                instance ?: run {
                    DeviceStorage.migrate(context, databaseName = DB_NAME)
                    AlarmDatabase(DeviceStorage.context(context)).also { instance = it }
                }
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
                created_at REAL NOT NULL,
                quiet_used INTEGER DEFAULT 0,
                preview INTEGER DEFAULT 0
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
                snooze_duration INTEGER DEFAULT 5,
                tasks TEXT
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
                completed_at REAL NOT NULL,
                outcome TEXT NOT NULL DEFAULT 'solved'
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
                snoozed_at REAL NOT NULL,
                quiet_used INTEGER DEFAULT 0
            )
        """)

        db.execSQL(AlarmMigrations.CREATE_QUIET_LEDGER)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        AlarmMigrations.apply(oldVersion, newVersion, db::execSQL)
    }

    override fun onOpen(db: SQLiteDatabase) {
        super.onOpen(db)
        db.enableWriteAheadLogging()

        // Legacy rows are keyed "friday" but fired alarms look up "jummah"; rename,
        // keeping an existing "jummah" row if both are present. Idempotent per open.
        // TODO(jummah-migration): remove once the installed base has updated past 2.10.
        db.execSQL("UPDATE OR IGNORE alarm_settings SET alarm_type = 'jummah' WHERE alarm_type = 'friday'")
        db.execSQL("DELETE FROM alarm_settings WHERE alarm_type = 'friday'")
    }

    // -- Alarms --

    fun saveAlarm(
        id: String,
        alarmType: String,
        title: String,
        triggerTime: Double,
        isBackup: Boolean = false,
        snoozeCount: Int = 0,
        quietUsed: Boolean = false,
        preview: Boolean = false
    ): Boolean {
        val values = ContentValues().apply {
            put("id", id)
            put("alarm_type", alarmType)
            put("title", title)
            put("trigger_time", triggerTime)
            put("completed", 0)
            put("is_backup", if (isBackup) 1 else 0)
            put("snooze_count", snoozeCount)
            put("created_at", System.currentTimeMillis().toDouble())
            put("quiet_used", if (quietUsed) 1 else 0)
            put("preview", if (preview) 1 else 0)
        }
        return writableDatabase.insertWithOnConflict("alarms", null, values, SQLiteDatabase.CONFLICT_REPLACE) != -1L
    }

    data class AlarmRecord(
        val id: String,
        val alarmType: String,
        val title: String,
        val triggerTime: Double,
        val completed: Boolean,
        val isBackup: Boolean,
        val snoozeCount: Int,
        // This alarm, its snoozes included, has had its emergency quiet.
        val quietUsed: Boolean = false,
        val preview: Boolean = false
    )

    private val alarmColumns =
        "id, alarm_type, title, trigger_time, completed, is_backup, snooze_count, quiet_used, preview"

    private fun alarmAt(cursor: Cursor) = AlarmRecord(
        id = cursor.getString(0),
        alarmType = cursor.getString(1),
        title = cursor.getString(2),
        triggerTime = cursor.getDouble(3),
        completed = cursor.getInt(4) == 1,
        isBackup = cursor.getInt(5) == 1,
        snoozeCount = cursor.getInt(6),
        quietUsed = cursor.getInt(7) == 1,
        preview = cursor.getInt(8) == 1
    )

    fun getAlarm(id: String): AlarmRecord? {
        val cursor = readableDatabase.rawQuery("SELECT $alarmColumns FROM alarms WHERE id = ?", arrayOf(id))
        return cursor.use { if (it.moveToFirst()) alarmAt(it) else null }
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

    // Uncompleted alarms set to ring after nowMs, re-arms included.
    fun getFutureAlarmIds(nowMs: Long): List<String> {
        val ids = mutableListOf<String>()
        val cursor = readableDatabase.rawQuery(
            "SELECT id FROM alarms WHERE completed = 0 AND is_backup = 0 AND trigger_time > ?",
            arrayOf(nowMs.toString())
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
            "SELECT $alarmColumns FROM alarms WHERE completed = 0 AND is_backup = 0",
            null
        )
        cursor.use {
            while (it.moveToNext()) alarms.add(alarmAt(it))
        }
        return alarms
    }

    fun getCompletedAlarmIds(): List<String> {
        val ids = mutableListOf<String>()
        val cursor = readableDatabase.rawQuery(
            "SELECT id FROM alarms WHERE completed = 1 AND is_backup = 0", null
        )
        cursor.use {
            while (it.moveToNext()) {
                ids.add(it.getString(0))
            }
        }
        return ids
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
            db.insertOrThrow("pending_challenge", null, values)
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

    // Completes and deletes the row, in one transaction, when [ownerId] is null
    // or names it; a row naming another alarm stays.
    fun clearPendingChallenge(ownerId: String? = null) {
        val db = writableDatabase
        db.beginTransactionNonExclusive()
        try {
            val pending = getPendingChallenge()
            if (pending != null && PendingChallengeRule.clearedBy(pending.alarmId, ownerId)) {
                markCompleted(pending.alarmId)
                db.delete("pending_challenge", null, null)
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
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

    fun addToCompletedQueue(alarmId: String, alarmType: String, title: String, outcome: String) {
        val values = ContentValues().apply {
            put("alarm_id", alarmId)
            put("alarm_type", alarmType)
            put("title", title)
            put("completed_at", System.currentTimeMillis() / 1000.0)
            put("outcome", outcome)
        }
        writableDatabase.insert("completed_queue", null, values)
    }

    data class CompletedAlarmRecord(
        val id: Long,
        val alarmId: String,
        val alarmType: String,
        val title: String,
        val completedAt: Double,
        val outcome: String
    )

    fun getCompletedQueue(): List<CompletedAlarmRecord> {
        val queue = mutableListOf<CompletedAlarmRecord>()
        val cursor = readableDatabase.rawQuery(
            "SELECT id, alarm_id, alarm_type, title, completed_at, outcome FROM completed_queue ORDER BY completed_at ASC",
            null
        )
        cursor.use {
            while (it.moveToNext()) {
                queue.add(
                    CompletedAlarmRecord(
                        id = it.getLong(0),
                        alarmId = it.getString(1),
                        alarmType = it.getString(2),
                        title = it.getString(3),
                        completedAt = it.getDouble(4),
                        outcome = it.getString(5)
                    )
                )
            }
        }
        return queue
    }

    fun clearCompletedQueue() {
        writableDatabase.delete("completed_queue", null, null)
    }

    fun clearCompletedQueue(ids: List<Long>) {
        if (ids.isEmpty()) return
        val placeholders = ids.joinToString(",") { "?" }
        val args = ids.map { it.toString() }.toTypedArray()
        writableDatabase.delete("completed_queue", "id IN ($placeholders)", args)
    }

    // -- Snooze Queue (for JS to process on app open) --

    fun addToSnoozeQueue(
        originalAlarmId: String,
        snoozeAlarmId: String,
        alarmType: String,
        title: String,
        snoozeCount: Int,
        snoozeEndTime: Double,
        quietUsed: Boolean = false
    ) {
        val values = ContentValues().apply {
            put("original_alarm_id", originalAlarmId)
            put("snooze_alarm_id", snoozeAlarmId)
            put("alarm_type", alarmType)
            put("title", title)
            put("snooze_count", snoozeCount)
            put("snooze_end_time", snoozeEndTime)
            put("snoozed_at", System.currentTimeMillis() / 1000.0)
            put("quiet_used", if (quietUsed) 1 else 0)
        }
        writableDatabase.insertOrThrow("snooze_queue", null, values)
    }

    data class SnoozeQueueRecord(
        val id: Long,
        val originalAlarmId: String,
        val snoozeAlarmId: String,
        val alarmType: String,
        val title: String,
        val snoozeCount: Int,
        val snoozeEndTime: Double,
        val quietUsed: Boolean
    )

    fun getSnoozeQueue(): List<SnoozeQueueRecord> {
        val queue = mutableListOf<SnoozeQueueRecord>()
        val cursor = readableDatabase.rawQuery(
            "SELECT id, original_alarm_id, snooze_alarm_id, alarm_type, title, snooze_count, snooze_end_time, quiet_used FROM snooze_queue ORDER BY snoozed_at ASC",
            null
        )
        cursor.use {
            while (it.moveToNext()) {
                queue.add(
                    SnoozeQueueRecord(
                        id = it.getLong(0),
                        originalAlarmId = it.getString(1),
                        snoozeAlarmId = it.getString(2),
                        alarmType = it.getString(3),
                        title = it.getString(4),
                        snoozeCount = it.getInt(5),
                        snoozeEndTime = it.getDouble(6),
                        quietUsed = it.getInt(7) == 1
                    )
                )
            }
        }
        return queue
    }

    fun clearSnoozeQueue() {
        writableDatabase.delete("snooze_queue", null, null)
    }

    fun clearSnoozeQueue(ids: List<Long>) {
        if (ids.isEmpty()) return
        val placeholders = ids.joinToString(",") { "?" }
        val args = ids.map { it.toString() }.toTypedArray()
        writableDatabase.delete("snooze_queue", "id IN ($placeholders)", args)
    }

    // -- Emergency quiet ledger (one row, shared by every alarm) --

    private data class QuietRow(val ledger: EmergencyQuiet.Ledger, val fromApp: Boolean)

    private fun readQuietRow(db: SQLiteDatabase): QuietRow? = db.rawQuery(
        "SELECT allowance, raise_to, raise_from, month, used, last_write_at, from_app FROM emergency_quiet WHERE id = 1",
        null
    ).use {
        if (!it.moveToFirst()) return@use null
        val raise = if (it.isNull(1) || it.isNull(2)) null else EmergencyQuiet.Raise(it.getInt(1), it.getInt(2))
        QuietRow(
            EmergencyQuiet.Ledger(
                allowance = it.getInt(0),
                raise = raise,
                month = if (it.isNull(3)) null else it.getInt(3),
                used = it.getInt(4),
                lastWriteAt = if (it.isNull(5)) null else it.getLong(5)
            ),
            fromApp = it.getInt(6) == 1
        )
    }

    private fun writeQuietRow(db: SQLiteDatabase, ledger: EmergencyQuiet.Ledger, fromApp: Boolean) {
        val values = ContentValues().apply {
            put("id", 1)
            put("allowance", ledger.allowance)
            put("raise_to", ledger.raise?.to)
            put("raise_from", ledger.raise?.from)
            put("month", ledger.month)
            put("used", ledger.used)
            put("last_write_at", ledger.lastWriteAt)
            put("from_app", if (fromApp) 1 else 0)
        }
        db.insertWithOnConflict("emergency_quiet", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    // One read-change-write under the database lock, so two writers never lose a use.
    private fun <T> quietTransaction(change: (SQLiteDatabase, QuietRow?) -> T): T {
        val db = writableDatabase
        db.beginTransactionNonExclusive()
        try {
            val result = change(db, readQuietRow(db))
            db.setTransactionSuccessful()
            return result
        } finally {
            db.endTransaction()
        }
    }

    fun getQuietLedger(): EmergencyQuiet.Ledger = readQuietRow(readableDatabase)?.ledger ?: EmergencyQuiet.NEW_LEDGER

    // Null until the app has written a ledger: no allowance is known before.
    fun quietLedgerOrNull(): EmergencyQuiet.Ledger? = readQuietRow(readableDatabase)?.ledger

    // Null, and nothing written, with none left or no ledger row. A throw from
    // [alsoWrite] undoes the count with it.
    fun recordQuietUse(now: Long, alsoWrite: () -> Unit = {}): EmergencyQuiet.Ledger? =
        quietTransaction { db, row ->
            row ?: return@quietTransaction null
            EmergencyQuiet.recordUse(row.ledger, now)?.also {
                writeQuietRow(db, it, row.fromApp)
                alsoWrite()
            }
        }

    // Null, and nothing written, with no ledger row: only a seed writes the first.
    fun setQuietAllowance(allowance: Int, now: Long): EmergencyQuiet.Ledger? = quietTransaction { db, row ->
        row ?: return@quietTransaction null
        EmergencyQuiet.setAllowance(row.ledger, allowance, now).also { writeQuietRow(db, it, row.fromApp) }
    }

    // Writes the app's saved ledger unless a seed already wrote one.
    fun seedQuietLedger(app: EmergencyQuiet.Ledger, now: Long): EmergencyQuiet.Ledger = quietTransaction { db, row ->
        val ledger = EmergencyQuiet.seedFrom(app, row?.takeIf { it.fromApp }?.ledger, now)
        if (row == null || !row.fromApp || ledger != row.ledger) writeQuietRow(db, ledger, fromApp = true)
        ledger
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
        val snoozeDuration: Int,
        val tasks: List<WakeTasks.Task>
    ) {
        val stored: WakeTasks.Stored
            get() = WakeTasks.Stored(
                WakeTasks.Challenge(challengeType, challengeDifficulty, challengeCount),
                tasks
            )

        fun with(stored: WakeTasks.Stored) = copy(
            challengeType = stored.challenge.type,
            challengeDifficulty = stored.challenge.difficulty,
            challengeCount = stored.challenge.count,
            tasks = stored.tasks
        )
    }

    fun getAlarmSettings(alarmType: String): AlarmSettingsRecord {
        val cursor = readableDatabase.rawQuery(
            """SELECT alarm_type, enabled, sound, volume, challenge_type, challenge_difficulty,
               challenge_count, gentle_wakeup_enabled, gentle_wakeup_duration, vibration_enabled,
               vibration_pattern, snooze_enabled, snooze_max_count, snooze_duration, tasks
               FROM alarm_settings WHERE alarm_type = ?""",
            arrayOf(alarmType)
        )
        return cursor.use {
            if (it.moveToFirst()) {
                val challenge = WakeTasks.Challenge(it.getString(4), it.getString(5), it.getInt(6))
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
                    snoozeDuration = it.getInt(13),
                    tasks = WakeTasks.resolve(challenge, if (it.isNull(14)) null else it.getString(14))
                )
            } else {
                // Return defaults
                val challenge = WakeTasks.Challenge(WakeTasks.CHALLENGE_TAP, WakeTasks.DEFAULT_DIFFICULTY, 1)
                AlarmSettingsRecord(
                    alarmType = alarmType,
                    enabled = false,
                    sound = "beep",
                    volume = 1.0f,
                    challengeType = challenge.type,
                    challengeDifficulty = challenge.difficulty,
                    challengeCount = challenge.count,
                    gentleWakeUpEnabled = false,
                    gentleWakeUpDuration = 3,
                    vibrationEnabled = true,
                    vibrationPattern = "default",
                    snoozeEnabled = true,
                    snoozeMaxCount = 3,
                    snoozeDuration = 5,
                    tasks = WakeTasks.fromChallenge(challenge)
                )
            }
        }
    }

    // Returns false when the row could not be written. Callers that are about to delete
    // the file a setting points at rely on this, so the insert result is not discarded.
    fun saveAlarmSettings(settings: AlarmSettingsRecord): Boolean {
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
            put("tasks", WakeTasks.encode(settings.tasks))
        }
        return try {
            writableDatabase.insertWithOnConflict(
                "alarm_settings", null, values, SQLiteDatabase.CONFLICT_REPLACE
            ) != -1L
        } catch (e: Exception) {
            false
        }
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

    // A challenge edit rebuilds the stack, as WakeTasks.write rules.
    fun updateChallenge(alarmType: String, change: (WakeTasks.Challenge) -> WakeTasks.Challenge): Boolean {
        val settings = getAlarmSettings(alarmType)
        val written = WakeTasks.write(settings.stored, null, change(settings.stored.challenge))
        return saveAlarmSettings(settings.with(written))
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
