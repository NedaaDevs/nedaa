import Foundation
import SQLite3

/// Alarm data for widget communication
struct AlarmData: Codable {
    let id: String
    let alarmType: String
    let title: String
    let triggerTime: Double  // Unix timestamp in milliseconds
    let completed: Bool
    let createdAt: Double
}

/// Database service for alarm state shared between app and widget
class AlarmDataService {
    static let shared = AlarmDataService()

    private let appGroupId = "group.dev.nedaa.app"
    private let dbPath: String = "nedaa.db"
    private let tableName = "alarms"

    private var db: OpaquePointer?

    private init() {
        createTableIfNeeded()
    }

    // MARK: - Table Management

    private func createTableIfNeeded() {
        do {
            try openDB()
            defer { closeDB() }

            let createSQL = """
                CREATE TABLE IF NOT EXISTS \(tableName) (
                    id TEXT PRIMARY KEY,
                    alarm_type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    trigger_time REAL NOT NULL,
                    completed INTEGER DEFAULT 0,
                    created_at REAL NOT NULL
                )
            """

            var statement: OpaquePointer?
            if sqlite3_prepare_v2(db, createSQL, -1, &statement, nil) == SQLITE_OK {
                if sqlite3_step(statement) != SQLITE_DONE {
                    let error = String(cString: sqlite3_errmsg(db)!)
                    Logger.database("[AlarmDataService] Error creating table: \(error)", level: .error)
                }
            }
            sqlite3_finalize(statement)

            Logger.database("[AlarmDataService] Table ready", level: .info)
        } catch {
            Logger.database("[AlarmDataService] Failed to create table: \(error)", level: .error)
        }
    }

    // MARK: - CRUD Operations

    /// Save or update an alarm
    func saveAlarm(_ alarm: AlarmData) -> Bool {
        do {
            try openDB()
            defer { closeDB() }

            let upsertSQL = """
                INSERT OR REPLACE INTO \(tableName)
                (id, alarm_type, title, trigger_time, completed, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """

            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(db, upsertSQL, -1, &statement, nil) == SQLITE_OK else {
                let error = String(cString: sqlite3_errmsg(db)!)
                Logger.database("[AlarmDataService] Error preparing save: \(error)", level: .error)
                return false
            }
            defer { sqlite3_finalize(statement) }

            sqlite3_bind_text(statement, 1, alarm.id, -1, nil)
            sqlite3_bind_text(statement, 2, alarm.alarmType, -1, nil)
            sqlite3_bind_text(statement, 3, alarm.title, -1, nil)
            sqlite3_bind_double(statement, 4, alarm.triggerTime)
            sqlite3_bind_int(statement, 5, alarm.completed ? 1 : 0)
            sqlite3_bind_double(statement, 6, alarm.createdAt)

            if sqlite3_step(statement) != SQLITE_DONE {
                let error = String(cString: sqlite3_errmsg(db)!)
                Logger.database("[AlarmDataService] Error saving alarm: \(error)", level: .error)
                return false
            }

            Logger.database("[AlarmDataService] Saved alarm: \(alarm.id)", level: .info)
            return true
        } catch {
            Logger.database("[AlarmDataService] Save failed: \(error)", level: .error)
            return false
        }
    }

    /// Get alarm by ID
    func getAlarm(id: String) -> AlarmData? {
        do {
            try openDB()
            defer { closeDB() }

            let query = "SELECT id, alarm_type, title, trigger_time, completed, created_at FROM \(tableName) WHERE id = ?"

            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK else {
                return nil
            }
            defer { sqlite3_finalize(statement) }

            sqlite3_bind_text(statement, 1, id, -1, nil)

            if sqlite3_step(statement) == SQLITE_ROW {
                return alarmFromStatement(statement)
            }

            return nil
        } catch {
            Logger.database("[AlarmDataService] Get alarm failed: \(error)", level: .error)
            return nil
        }
    }

    /// Get all pending (not completed) alarms
    func getPendingAlarms() -> [AlarmData] {
        do {
            try openDB()
            defer { closeDB() }

            let query = "SELECT id, alarm_type, title, trigger_time, completed, created_at FROM \(tableName) WHERE completed = 0 ORDER BY trigger_time ASC"

            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK else {
                return []
            }
            defer { sqlite3_finalize(statement) }

            var alarms: [AlarmData] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                if let alarm = alarmFromStatement(statement) {
                    alarms.append(alarm)
                }
            }

            Logger.database("[AlarmDataService] Found \(alarms.count) pending alarms", level: .info)
            return alarms
        } catch {
            Logger.database("[AlarmDataService] Get pending alarms failed: \(error)", level: .error)
            return []
        }
    }

    /// Mark alarm as completed
    func markCompleted(id: String) -> Bool {
        do {
            try openDB()
            defer { closeDB() }

            let updateSQL = "UPDATE \(tableName) SET completed = 1 WHERE id = ?"

            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(db, updateSQL, -1, &statement, nil) == SQLITE_OK else {
                return false
            }
            defer { sqlite3_finalize(statement) }

            sqlite3_bind_text(statement, 1, id, -1, nil)

            if sqlite3_step(statement) != SQLITE_DONE {
                return false
            }

            Logger.database("[AlarmDataService] Marked completed: \(id)", level: .info)
            return true
        } catch {
            Logger.database("[AlarmDataService] Mark completed failed: \(error)", level: .error)
            return false
        }
    }

    /// Delete alarm
    func deleteAlarm(id: String) -> Bool {
        do {
            try openDB()
            defer { closeDB() }

            let deleteSQL = "DELETE FROM \(tableName) WHERE id = ?"

            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(db, deleteSQL, -1, &statement, nil) == SQLITE_OK else {
                return false
            }
            defer { sqlite3_finalize(statement) }

            sqlite3_bind_text(statement, 1, id, -1, nil)

            if sqlite3_step(statement) != SQLITE_DONE {
                return false
            }

            Logger.database("[AlarmDataService] Deleted alarm: \(id)", level: .info)
            return true
        } catch {
            Logger.database("[AlarmDataService] Delete failed: \(error)", level: .error)
            return false
        }
    }

    /// Delete all completed alarms older than given hours
    func cleanupOldAlarms(olderThanHours: Int = 24) {
        do {
            try openDB()
            defer { closeDB() }

            let cutoffTime = Date().timeIntervalSince1970 * 1000 - Double(olderThanHours * 60 * 60 * 1000)
            let deleteSQL = "DELETE FROM \(tableName) WHERE completed = 1 AND trigger_time < ?"

            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(db, deleteSQL, -1, &statement, nil) == SQLITE_OK else {
                return
            }
            defer { sqlite3_finalize(statement) }

            sqlite3_bind_double(statement, 1, cutoffTime)
            sqlite3_step(statement)

            Logger.database("[AlarmDataService] Cleaned up old alarms", level: .info)
        } catch {
            Logger.database("[AlarmDataService] Cleanup failed: \(error)", level: .error)
        }
    }

    // MARK: - Helpers

    private func alarmFromStatement(_ statement: OpaquePointer?) -> AlarmData? {
        guard let statement = statement else { return nil }

        guard let idPtr = sqlite3_column_text(statement, 0),
              let typePtr = sqlite3_column_text(statement, 1),
              let titlePtr = sqlite3_column_text(statement, 2) else {
            return nil
        }

        return AlarmData(
            id: String(cString: idPtr),
            alarmType: String(cString: typePtr),
            title: String(cString: titlePtr),
            triggerTime: sqlite3_column_double(statement, 3),
            completed: sqlite3_column_int(statement, 4) == 1,
            createdAt: sqlite3_column_double(statement, 5)
        )
    }

    // MARK: - Database Connection

    private func openDB() throws {
        let fileManager = FileManager.default
        guard let directory = fileManager.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
            throw NSError(domain: "AlarmDataService", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not access app group"])
        }

        let dbFile = directory.appendingPathComponent(dbPath)

        if sqlite3_open(dbFile.path, &db) != SQLITE_OK {
            let error = db != nil ? String(cString: sqlite3_errmsg(db)!) : "Unknown"
            throw NSError(domain: "AlarmDataService", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not open DB: \(error)"])
        }
    }

    private func closeDB() {
        if let database = db {
            sqlite3_close(database)
            db = nil
        }
    }
}
