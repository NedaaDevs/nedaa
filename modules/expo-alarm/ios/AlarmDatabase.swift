import SQLite3
import Foundation

class AlarmDatabase {
    static let shared = AlarmDatabase()
    private let appGroupId = "group.dev.nedaa.app"
    private let dbPath = "alarm_state.db"
    private let queue = DispatchQueue(label: "dev.nedaa.app.alarmdb", qos: .userInitiated)

    private init() {
        createTablesIfNeeded()
    }

    // MARK: - DB Lifecycle

    private func getDBPath() -> String? {
        guard let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
            return nil
        }
        return directory.appendingPathComponent(dbPath).path
    }

    private func openDB() -> OpaquePointer? {
        guard let path = getDBPath() else { return nil }
        var db: OpaquePointer?
        guard sqlite3_open(path, &db) == SQLITE_OK else { return nil }

        sqlite3_exec(db, "PRAGMA journal_mode=WAL", nil, nil, nil)
        sqlite3_busy_timeout(db, 5000)

        return db
    }

    private func createTablesIfNeeded() {
        queue.sync {
            guard let db = openDB() else { return }
            defer { sqlite3_close(db) }

            let alarmsSql = """
                CREATE TABLE IF NOT EXISTS alarms (
                    id TEXT PRIMARY KEY,
                    alarm_type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    trigger_time REAL NOT NULL,
                    completed INTEGER DEFAULT 0,
                    is_backup INTEGER DEFAULT 0,
                    created_at REAL NOT NULL
                )
            """
            sqlite3_exec(db, alarmsSql, nil, nil, nil)

            let pendingSql = """
                CREATE TABLE IF NOT EXISTS pending_challenge (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    alarm_id TEXT NOT NULL,
                    alarm_type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    timestamp REAL NOT NULL
                )
            """
            sqlite3_exec(db, pendingSql, nil, nil, nil)

            let bypassSql = """
                CREATE TABLE IF NOT EXISTS bypass_state (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    alarm_id TEXT NOT NULL,
                    alarm_type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    activated_at REAL NOT NULL
                )
            """
            sqlite3_exec(db, bypassSql, nil, nil, nil)

            sqlite3_exec(db, "ALTER TABLE alarms ADD COLUMN is_backup INTEGER DEFAULT 0", nil, nil, nil)
        }
    }

    // MARK: - Query Helpers

    private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    @discardableResult
    private func execute(_ sql: String, bind: ((OpaquePointer) -> Void)? = nil) -> Bool {
        queue.sync {
            guard let db = openDB() else { return false }
            defer { sqlite3_close(db) }
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return false }
            defer { sqlite3_finalize(stmt) }
            bind?(stmt!)
            sqlite3_step(stmt)
            return true
        }
    }

    private func query<T>(_ sql: String, bind: ((OpaquePointer) -> Void)? = nil, extract: (OpaquePointer) -> T) -> [T] {
        queue.sync {
            guard let db = openDB() else { return [] }
            defer { sqlite3_close(db) }
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
            defer { sqlite3_finalize(stmt) }
            bind?(stmt!)
            var results: [T] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                results.append(extract(stmt!))
            }
            return results
        }
    }

    private func querySingle<T>(_ sql: String, bind: ((OpaquePointer) -> Void)? = nil, extract: (OpaquePointer) -> T) -> T? {
        queue.sync {
            guard let db = openDB() else { return nil }
            defer { sqlite3_close(db) }
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return nil }
            defer { sqlite3_finalize(stmt) }
            bind?(stmt!)
            if sqlite3_step(stmt) == SQLITE_ROW {
                return extract(stmt!)
            }
            return nil
        }
    }

    @discardableResult
    private func execRaw(_ sql: String) -> Bool {
        queue.sync {
            guard let db = openDB() else { return false }
            defer { sqlite3_close(db) }
            return sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK
        }
    }

    // MARK: - Alarms

    func saveAlarm(id: String, alarmType: String, title: String, triggerTime: Double, isBackup: Bool = false) {
        let sql = """
            INSERT OR REPLACE INTO alarms
            (id, alarm_type, title, trigger_time, completed, is_backup, created_at)
            VALUES (?, ?, ?, ?, 0, ?, ?)
        """
        execute(sql) { [SQLITE_TRANSIENT] stmt in
            sqlite3_bind_text(stmt, 1, id, -1, SQLITE_TRANSIENT)
            sqlite3_bind_text(stmt, 2, alarmType, -1, SQLITE_TRANSIENT)
            sqlite3_bind_text(stmt, 3, title, -1, SQLITE_TRANSIENT)
            sqlite3_bind_double(stmt, 4, triggerTime)
            sqlite3_bind_int(stmt, 5, isBackup ? 1 : 0)
            sqlite3_bind_double(stmt, 6, Date().timeIntervalSince1970 * 1000)
        }
        PersistentLog.shared.alarm("DB: Saved alarm \(id.prefix(8)) isBackup=\(isBackup)")
    }

    func getAlarm(id: String) -> (alarmType: String, title: String, triggerTime: Double, completed: Bool)? {
        querySingle(
            "SELECT alarm_type, title, trigger_time, completed FROM alarms WHERE id = ?",
            bind: { [SQLITE_TRANSIENT] stmt in
                sqlite3_bind_text(stmt, 1, id, -1, SQLITE_TRANSIENT)
            },
            extract: { stmt in
                (
                    String(cString: sqlite3_column_text(stmt, 0)),
                    String(cString: sqlite3_column_text(stmt, 1)),
                    sqlite3_column_double(stmt, 2),
                    sqlite3_column_int(stmt, 3) == 1
                )
            }
        )
    }

    func getAllAlarmIds() -> [String] {
        query("SELECT id FROM alarms WHERE is_backup = 0") { stmt in
            String(cString: sqlite3_column_text(stmt, 0))
        }
    }

    func getBackupAlarmIds() -> [String] {
        query("SELECT id FROM alarms WHERE is_backup = 1") { stmt in
            String(cString: sqlite3_column_text(stmt, 0))
        }
    }

    func markCompleted(id: String) {
        execute("UPDATE alarms SET completed = 1 WHERE id = ?") { [SQLITE_TRANSIENT] stmt in
            sqlite3_bind_text(stmt, 1, id, -1, SQLITE_TRANSIENT)
        }
        PersistentLog.shared.alarm("DB: Marked completed \(id.prefix(8))")
    }

    func isCompleted(id: String) -> Bool {
        guard let alarm = getAlarm(id: id) else { return false }
        return alarm.completed
    }

    func clearCompleted(id: String) {
        execute("UPDATE alarms SET completed = 0 WHERE id = ?") { [SQLITE_TRANSIENT] stmt in
            sqlite3_bind_text(stmt, 1, id, -1, SQLITE_TRANSIENT)
        }
    }

    func deleteAlarm(id: String) {
        execute("DELETE FROM alarms WHERE id = ?") { [SQLITE_TRANSIENT] stmt in
            sqlite3_bind_text(stmt, 1, id, -1, SQLITE_TRANSIENT)
        }
        PersistentLog.shared.alarm("DB: Deleted alarm \(id.prefix(8))")
    }

    func deleteAllBackups() {
        execRaw("DELETE FROM alarms WHERE is_backup = 1")
        PersistentLog.shared.alarm("DB: Deleted all backup alarms")
    }

    func deleteAllAlarms() {
        execRaw("DELETE FROM alarms")
        PersistentLog.shared.alarm("DB: Deleted all alarms")
    }

    // MARK: - Pending Challenge

    func setPendingChallenge(alarmId: String, alarmType: String, title: String) {
        execRaw("DELETE FROM pending_challenge")
        let sql = """
            INSERT INTO pending_challenge (id, alarm_id, alarm_type, title, timestamp)
            VALUES (1, ?, ?, ?, ?)
        """
        execute(sql) { [SQLITE_TRANSIENT] stmt in
            sqlite3_bind_text(stmt, 1, alarmId, -1, SQLITE_TRANSIENT)
            sqlite3_bind_text(stmt, 2, alarmType, -1, SQLITE_TRANSIENT)
            sqlite3_bind_text(stmt, 3, title, -1, SQLITE_TRANSIENT)
            sqlite3_bind_double(stmt, 4, Date().timeIntervalSince1970)
        }
        PersistentLog.shared.alarm("DB: Set pending challenge \(alarmId.prefix(8))")
    }

    func getPendingChallenge() -> [String: Any]? {
        querySingle(
            "SELECT alarm_id, alarm_type, title, timestamp FROM pending_challenge WHERE id = 1",
            extract: { stmt in
                [
                    "alarmId": String(cString: sqlite3_column_text(stmt, 0)),
                    "alarmType": String(cString: sqlite3_column_text(stmt, 1)),
                    "title": String(cString: sqlite3_column_text(stmt, 2)),
                    "timestamp": sqlite3_column_double(stmt, 3)
                ] as [String: Any]
            }
        )
    }

    func clearPendingChallenge() {
        if let pending = getPendingChallenge(), let alarmId = pending["alarmId"] as? String {
            markCompleted(id: alarmId)
        }
        execRaw("DELETE FROM pending_challenge")
        PersistentLog.shared.alarm("DB: Cleared pending challenge")
    }

    // MARK: - Scheduling

    func getNextAlarmTime() -> Date? {
        querySingle(
            "SELECT MIN(trigger_time) FROM alarms WHERE completed = 0 AND is_backup = 0",
            extract: { stmt in
                guard sqlite3_column_type(stmt, 0) != SQLITE_NULL else { return nil }
                let timestamp = sqlite3_column_double(stmt, 0)
                return Date(timeIntervalSince1970: timestamp / 1000.0)
            }
        ) ?? nil
    }

    func getMetadata(for alarmId: String) -> (alarmType: String, title: String)? {
        guard let alarm = getAlarm(id: alarmId) else { return nil }
        return (alarm.alarmType, alarm.title)
    }

    func hasAlarms() -> Bool {
        return !getAllAlarmIds().isEmpty
    }

    // MARK: - Completed

    func clearAllCompleted() {
        execRaw("UPDATE alarms SET completed = 0")
        PersistentLog.shared.alarm("DB: Cleared all completed statuses")
    }

    func getCompletedCount() -> Int {
        querySingle("SELECT COUNT(*) FROM alarms WHERE completed = 1") { stmt in
            Int(sqlite3_column_int(stmt, 0))
        } ?? 0
    }

    // MARK: - Bypass State

    func setBypassState(alarmId: String, alarmType: String, title: String) {
        execRaw("DELETE FROM bypass_state")
        let sql = """
            INSERT INTO bypass_state (id, alarm_id, alarm_type, title, activated_at)
            VALUES (1, ?, ?, ?, ?)
        """
        execute(sql) { [SQLITE_TRANSIENT] stmt in
            sqlite3_bind_text(stmt, 1, alarmId, -1, SQLITE_TRANSIENT)
            sqlite3_bind_text(stmt, 2, alarmType, -1, SQLITE_TRANSIENT)
            sqlite3_bind_text(stmt, 3, title, -1, SQLITE_TRANSIENT)
            sqlite3_bind_double(stmt, 4, Date().timeIntervalSince1970)
        }
        PersistentLog.shared.alarm("DB: Set bypass state \(alarmId.prefix(8))")
    }

    func getBypassState() -> (alarmId: String, alarmType: String, title: String, activatedAt: Double)? {
        querySingle(
            "SELECT alarm_id, alarm_type, title, activated_at FROM bypass_state WHERE id = 1",
            extract: { stmt in
                (
                    String(cString: sqlite3_column_text(stmt, 0)),
                    String(cString: sqlite3_column_text(stmt, 1)),
                    String(cString: sqlite3_column_text(stmt, 2)),
                    sqlite3_column_double(stmt, 3)
                )
            }
        )
    }

    func clearBypassState() {
        execRaw("DELETE FROM bypass_state")
        PersistentLog.shared.alarm("DB: Cleared bypass state")
    }
}
