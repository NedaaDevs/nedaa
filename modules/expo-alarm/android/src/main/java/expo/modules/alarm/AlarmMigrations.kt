package expo.modules.alarm

// Upgrades of alarm_state.db; a step at version N lifts N-1 to N.
object AlarmMigrations {

    data class Step(val version: Int, val sql: String, val addsColumn: Boolean = false)

    // Listed oldest first; a later step may rely on an earlier one's table.
    val STEPS: List<Step> = listOf(
        Step(2, """
            CREATE TABLE IF NOT EXISTS completed_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alarm_id TEXT NOT NULL,
                alarm_type TEXT NOT NULL,
                title TEXT NOT NULL,
                completed_at REAL NOT NULL
            )
        """.trimIndent()),
        Step(3, "ALTER TABLE alarms ADD COLUMN snooze_count INTEGER DEFAULT 0", addsColumn = true),
        Step(3, """
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
        """.trimIndent()),
        Step(4, """
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
        """.trimIndent()),
        Step(
            5,
            "ALTER TABLE completed_queue ADD COLUMN outcome TEXT NOT NULL DEFAULT 'solved'",
            addsColumn = true
        ),
    )

    val LATEST_VERSION: Int = STEPS.last().version

    // SQLite's message for re-adding a column; the only failure skipped.
    private const val DUPLICATE_COLUMN = "duplicate column name"

    fun steps(oldVersion: Int, newVersion: Int): List<Step> =
        STEPS.filter { it.version in (oldVersion + 1)..newVersion }

    // SQLiteException is a RuntimeException; any other failure stops the upgrade.
    fun apply(oldVersion: Int, newVersion: Int, exec: (String) -> Unit) {
        for (step in steps(oldVersion, newVersion)) {
            try {
                exec(step.sql)
            } catch (e: RuntimeException) {
                if (!step.addsColumn || e.message?.contains(DUPLICATE_COLUMN) != true) throw e
            }
        }
    }
}
