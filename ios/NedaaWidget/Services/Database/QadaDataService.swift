import Foundation
import SQLite3

/// Service for managing Qada (missed fasts) data
class QadaDataService {
    // MARK: - Properties

    private let appGroupId = "group.dev.nedaa.app"
    private let dbPath: String = "nedaa.db"
    private var db: OpaquePointer?

    // Table and column names
    private let qadaFastsTable = "qada_fasts"
    private let qadaHistoryTable = "qada_history"
    private let columnId = "id"
    private let columnTotalMissed = "total_missed"
    private let columnTotalCompleted = "total_completed"
    private let columnCreatedAt = "created_at"

    // History table columns
    private let columnCount = "count"
    private let columnType = "type"
    private let columnStatus = "status"

    // Retry configuration
    private let maxRetries = 3
    private let retryDelay: TimeInterval = 0.5

    // MARK: - Public Methods

    /// Gets the Qada fasts data
    /// - Returns: QadaFastData object with total missed and completed counts
    func getQadaFasts() -> QadaFastData? {
        var attempt = 0
        var result: QadaFastData? = nil

        while attempt < maxRetries && result == nil {
            if attempt > 0 {
                Logger.database("Retrying Qada fasts query (attempt \(attempt+1)/\(maxRetries))", level: .info)
                Thread.sleep(forTimeInterval: retryDelay * Double(attempt))
            }

            result = fetchQadaFasts()
            attempt += 1
        }

        if let qadaData = result {
            Logger.database("Retrieved Qada fasts data: \(qadaData.totalMissed) remaining, \(qadaData.totalCompleted) completed", level: .info)
            return qadaData
        } else {
            Logger.database("Failed to retrieve Qada fasts after \(maxRetries) attempts", level: .error)
            return nil
        }
    }

    /// Gets the number of fasts completed today from history
    /// - Returns: Number of fasts completed today
    func getTodayCompletedCount() -> Int {
        let today = Date()
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: today)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) ?? today

        do {
            try openDB()
            defer { closeDB() }

            var statement: OpaquePointer?
            let query = """
                SELECT SUM(\(columnCount))
                FROM \(qadaHistoryTable)
                WHERE \(columnType) = 'completed'
                AND \(columnStatus) = 'completed'
                AND datetime(\(columnCreatedAt)) >= datetime(?)
                AND datetime(\(columnCreatedAt)) < datetime(?)
                """

            defer { sqlite3_finalize(statement) }

            if sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK {
                let dateFormatter = ISO8601DateFormatter()
                sqlite3_bind_text(statement, 1, (dateFormatter.string(from: startOfDay) as NSString).utf8String, -1, nil)
                sqlite3_bind_text(statement, 2, (dateFormatter.string(from: endOfDay) as NSString).utf8String, -1, nil)

                if sqlite3_step(statement) == SQLITE_ROW {
                    let count = sqlite3_column_int(statement, 0)
                    Logger.database("Today's completed Qada count: \(count)", level: .info)
                    return Int(count)
                }
            } else {
                let errmsg = String(cString: sqlite3_errmsg(db)!)
                Logger.database("Error querying today's Qada completions: \(errmsg)", level: .error)
            }

            return 0
        } catch {
            Logger.database("Error getting today's completion count: \(error.localizedDescription)", level: .error)
            return 0
        }
    }

    // MARK: - Private Methods

    /// Fetches Qada fasts data from the database
    private func fetchQadaFasts() -> QadaFastData? {
        do {
            try openDB()
            defer { closeDB() }

            var statement: OpaquePointer?
            let query = """
                SELECT \(columnTotalMissed), \(columnTotalCompleted)
                FROM \(qadaFastsTable)
                WHERE \(columnId) = 1
                LIMIT 1
                """

            defer { sqlite3_finalize(statement) }

            if sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK {
                if sqlite3_step(statement) == SQLITE_ROW {
                    let totalMissed = Int(sqlite3_column_int(statement, 0))
                    let totalCompleted = Int(sqlite3_column_int(statement, 1))

                    return QadaFastData(
                        totalMissed: totalMissed,
                        totalCompleted: totalCompleted
                    )
                } else {
                    Logger.database("No Qada fasts data found", level: .info)
                    // Return default empty data
                    return QadaFastData(totalMissed: 0, totalCompleted: 0)
                }
            } else {
                let errmsg = String(cString: sqlite3_errmsg(db)!)
                Logger.database("Error preparing Qada fasts query: \(errmsg)", level: .error)
                return nil
            }
        } catch {
            Logger.database("Error fetching Qada fasts: \(error.localizedDescription)", level: .error)
            return nil
        }
    }

    /// Opens a connection to the database
    private func openDB() throws {
        let fileManager = FileManager.default
        guard let directory = fileManager.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
            let message = "Could not access app group container: \(appGroupId)"
            Logger.database(message, level: .error)
            throw DatabaseError.openError(message: message)
        }

        let dbFile = directory.appendingPathComponent(dbPath)

        // Check if the database file exists
        if !fileManager.fileExists(atPath: dbFile.path) {
            let message = "Database file does not exist at \(dbFile.path)"
            Logger.database(message, level: .error)
            throw DatabaseError.openError(message: message)
        }

        // Open the database
        if sqlite3_open(dbFile.path, &db) != SQLITE_OK {
            let errorMessage = db != nil ? String(cString: sqlite3_errmsg(db!)) : "Unknown error"
            let message = "Error opening database: \(errorMessage)"
            Logger.database(message, level: .error)

            if db != nil {
                sqlite3_close(db)
                db = nil
            }

            throw DatabaseError.openError(message: message)
        }

        Logger.database("Successfully opened database for Qada operations", level: .debug)
    }

    /// Closes the database connection
    private func closeDB() {
        guard let database = db else { return }

        if sqlite3_close(database) != SQLITE_OK {
            let errorMessage = String(cString: sqlite3_errmsg(database))
            Logger.database("Error closing database: \(errorMessage)", level: .warning)
        } else {
            Logger.database("Successfully closed database connection", level: .debug)
        }

        db = nil
    }
}

// MARK: - Convenience Extensions

extension QadaDataService {
    /// Gets a complete summary of Qada data
    /// - Returns: QadaSummary object with all relevant data
    func getQadaSummary() -> QadaSummary {
        let qadaData = getQadaFasts()
        let todayCompleted = getTodayCompletedCount()

        return QadaSummary(
            totalMissed: qadaData?.totalMissed ?? 0,
            totalCompleted: qadaData?.totalCompleted ?? 0,
            todayCompleted: todayCompleted
        )
    }
    
    /// Records completion of Qada fasts
    /// - Parameter count: Number of fasts to mark as complete
    /// - Returns: Boolean indicating success
    func recordCompletion(count: Int) -> Bool {
        guard count > 0 else {
            Logger.database("Invalid count for recording completion: \(count)", level: .warning)
            return false
        }
        
        do {
            try openDB()
            defer { closeDB() }
            
            var statement: OpaquePointer?
            
            // Update qada_fasts table
            let updateQuery = """
                UPDATE \(qadaFastsTable)
                SET \(columnTotalCompleted) = \(columnTotalCompleted) + ?,
                    \(columnTotalMissed) = \(columnTotalMissed) - ?
                WHERE \(columnId) = 1
                """
            
            if sqlite3_prepare_v2(db, updateQuery, -1, &statement, nil) == SQLITE_OK {
                sqlite3_bind_int(statement, 1, Int32(count))
                sqlite3_bind_int(statement, 2, Int32(count))
                
                let result = sqlite3_step(statement)
                sqlite3_finalize(statement)
                
                if result == SQLITE_DONE {
                    // Also record in history
                    recordHistory(count: count, type: "completed")
                    Logger.database("Successfully recorded \(count) fast(s) as completed", level: .info)
                    return true
                } else {
                    let errorMessage = String(cString: sqlite3_errmsg(db))
                    Logger.database("Failed to update qada_fasts: \(errorMessage)", level: .error)
                }
            } else {
                let errorMessage = String(cString: sqlite3_errmsg(db))
                Logger.database("Failed to prepare update statement: \(errorMessage)", level: .error)
            }
            
            sqlite3_finalize(statement)
            return false
        } catch {
            Logger.database("Error recording completion: \(error.localizedDescription)", level: .error)
            return false
        }
    }
    
    /// Records fast completion in history table
    /// - Parameters:
    ///   - count: Number of fasts
    ///   - type: Type of record (e.g., "completed", "added")
    private func recordHistory(count: Int, type: String) {
        var statement: OpaquePointer?
        
        let insertQuery = """
            INSERT INTO \(qadaHistoryTable) (\(columnCount), \(columnType), \(columnStatus), \(columnCreatedAt))
            VALUES (?, ?, 'completed', datetime('now'))
            """
        
        if sqlite3_prepare_v2(db, insertQuery, -1, &statement, nil) == SQLITE_OK {
            sqlite3_bind_int(statement, 1, Int32(count))
            sqlite3_bind_text(statement, 2, (type as NSString).utf8String, -1, nil)
            
            if sqlite3_step(statement) != SQLITE_DONE {
                let errorMessage = String(cString: sqlite3_errmsg(db))
                Logger.database("Failed to insert history record: \(errorMessage)", level: .warning)
            }
        }
        
        sqlite3_finalize(statement)
    }
}
