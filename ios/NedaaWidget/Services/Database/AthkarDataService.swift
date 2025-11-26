import Foundation
import SQLite3

/// Service for managing Athkar
class AthkarDataService {
    // MARK: - Properties

    private let appGroupId = "group.dev.nedaa.app"
    private let dbPath: String = "athkar.db"  // Athkar has its own separate database!
    private var db: OpaquePointer?

    // Table names
    private let athkarStreakTable = "athkar_streak"
    private let athkarCompletedDaysTable = "athkar_completed_days"
    private let athkarDailyItemsTable = "athkar_daily_items"

    // Retry configuration
    private let maxRetries = 3
    private let retryDelay: TimeInterval = 0.5

    // MARK: - Public Methods

    /// Gets today's athkar completion status (morning and evening)
    /// - Returns: AthkarCompletionData with completion status
    func getTodayCompletion() -> AthkarCompletionData? {
        var attempt = 0
        var result: AthkarCompletionData? = nil

        while attempt < maxRetries && result == nil {
            if attempt > 0 {
                Logger.database("Retrying athkar completion query (attempt \(attempt+1)/\(maxRetries))", level: .info)
                Thread.sleep(forTimeInterval: retryDelay * Double(attempt))
            }

            result = fetchTodayCompletion()
            attempt += 1
        }

        if let completion = result {
            Logger.database("Retrieved athkar completion: Morning=\(completion.morningCompleted), Evening=\(completion.eveningCompleted)", level: .info)
            return completion
        } else {
            Logger.database("Failed to retrieve athkar completion after \(maxRetries) attempts", level: .error)
            return nil
        }
    }

    /// Gets current streak information
    /// - Returns: AthkarStreakData with current and longest streak
    func getStreakData() -> AthkarStreakData? {
        do {
            try openDB()
            defer { closeDB() }

            var statement: OpaquePointer?
            let query = """
                SELECT current_streak, longest_streak, last_streak_date, is_paused
                FROM \(athkarStreakTable)
                WHERE id = 1
                LIMIT 1
                """

            defer { sqlite3_finalize(statement) }

            if sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK {
                if sqlite3_step(statement) == SQLITE_ROW {
                    let currentStreak = Int(sqlite3_column_int(statement, 0))
                    let longestStreak = Int(sqlite3_column_int(statement, 1))

                    // last_streak_date can be NULL
                    var lastStreakDate: Int? = nil
                    if sqlite3_column_type(statement, 2) != SQLITE_NULL {
                        lastStreakDate = Int(sqlite3_column_int(statement, 2))
                    }

                    let isPaused = sqlite3_column_int(statement, 3) == 1

                    return AthkarStreakData(
                        currentStreak: currentStreak,
                        longestStreak: longestStreak,
                        lastStreakDate: lastStreakDate,
                        isPaused: isPaused
                    )
                } else {
                    Logger.database("No streak data found, returning default", level: .info)
                    return AthkarStreakData(currentStreak: 0, longestStreak: 0, lastStreakDate: nil, isPaused: false)
                }
            } else {
                let errmsg = String(cString: sqlite3_errmsg(db)!)
                Logger.database("Error preparing streak query: \(errmsg)", level: .error)
                return nil
            }
        } catch {
            Logger.database("Error fetching streak data: \(error.localizedDescription)", level: .error)
            return nil
        }
    }

    /// Gets today's athkar progress (completed items)
    /// - Returns: AthkarProgressData with item counts
    func getTodayProgress() -> AthkarProgressData? {
        let todayDate = getTodayDateInt()

        do {
            try openDB()
            defer { closeDB() }

            var statement: OpaquePointer?
            let query = """
                SELECT COUNT(*) as total_items,
                       SUM(CASE WHEN current_count >= total_count THEN 1 ELSE 0 END) as completed_items
                FROM \(athkarDailyItemsTable)
                WHERE date = ?
                """

            defer { sqlite3_finalize(statement) }

            if sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK {
                sqlite3_bind_int(statement, 1, Int32(todayDate))

                if sqlite3_step(statement) == SQLITE_ROW {
                    let totalItems = Int(sqlite3_column_int(statement, 0))
                    let completedItems = Int(sqlite3_column_int(statement, 1))

                    return AthkarProgressData(
                        totalItems: totalItems,
                        completedItems: completedItems
                    )
                } else {
                    Logger.database("No athkar items found for today", level: .info)
                    return AthkarProgressData(totalItems: 0, completedItems: 0)
                }
            } else {
                let errmsg = String(cString: sqlite3_errmsg(db)!)
                Logger.database("Error preparing progress query: \(errmsg)", level: .error)
                return nil
            }
        } catch {
            Logger.database("Error fetching progress data: \(error.localizedDescription)", level: .error)
            return nil
        }
    }

    /// Gets complete athkar summary for widgets
    /// - Returns: AthkarSummary with all relevant data
    func getAthkarSummary() -> AthkarSummary {
        let completion = getTodayCompletion()
        let streak = getStreakData()
        let progress = getTodayProgress()

        return AthkarSummary(
            morningCompleted: completion?.morningCompleted ?? false,
            eveningCompleted: completion?.eveningCompleted ?? false,
            currentStreak: streak?.currentStreak ?? 0,
            longestStreak: streak?.longestStreak ?? 0,
            totalItems: progress?.totalItems ?? 0,
            completedItems: progress?.completedItems ?? 0
        )
    }

    // MARK: - Private Methods

    /// Fetches today's completion status from the database
    private func fetchTodayCompletion() -> AthkarCompletionData? {
        let todayDate = getTodayDateInt()

        do {
            try openDB()
            defer { closeDB() }

            var statement: OpaquePointer?
            let query = """
                SELECT morning_completed_at, evening_completed_at
                FROM \(athkarCompletedDaysTable)
                WHERE date = ?
                LIMIT 1
                """

            defer { sqlite3_finalize(statement) }

            if sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK {
                sqlite3_bind_int(statement, 1, Int32(todayDate))

                if sqlite3_step(statement) == SQLITE_ROW {
                    // Check if morning_completed_at is NULL
                    let morningCompleted = sqlite3_column_type(statement, 0) != SQLITE_NULL
                    // Check if evening_completed_at is NULL
                    let eveningCompleted = sqlite3_column_type(statement, 1) != SQLITE_NULL

                    return AthkarCompletionData(
                        morningCompleted: morningCompleted,
                        eveningCompleted: eveningCompleted,
                        date: todayDate
                    )
                } else {
                    Logger.database("No completion data for today, returning false", level: .info)
                    return AthkarCompletionData(morningCompleted: false, eveningCompleted: false, date: todayDate)
                }
            } else {
                let errmsg = String(cString: sqlite3_errmsg(db)!)
                Logger.database("Error preparing completion query: \(errmsg)", level: .error)
                return nil
            }
        } catch {
            Logger.database("Error fetching today's completion: \(error.localizedDescription)", level: .error)
            return nil
        }
    }

    /// Opens a connection to the athkar database
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
            let message = "Athkar database file does not exist at \(dbFile.path)"
            Logger.database(message, level: .warning)
            throw DatabaseError.openError(message: message)
        }

        // Open the database
        if sqlite3_open(dbFile.path, &db) != SQLITE_OK {
            let errorMessage = db != nil ? String(cString: sqlite3_errmsg(db!)) : "Unknown error"
            let message = "Error opening athkar database: \(errorMessage)"
            Logger.database(message, level: .error)

            if db != nil {
                sqlite3_close(db)
                db = nil
            }

            throw DatabaseError.openError(message: message)
        }

        Logger.database("Successfully opened athkar database", level: .debug)
    }

    /// Closes the database connection
    private func closeDB() {
        guard let database = db else { return }

        if sqlite3_close(database) != SQLITE_OK {
            let errorMessage = String(cString: sqlite3_errmsg(database))
            Logger.database("Error closing athkar database: \(errorMessage)", level: .warning)
        } else {
            Logger.database("Successfully closed athkar database connection", level: .debug)
        }

        db = nil
    }

    /// Gets today's date as an integer in YYYYMMDD format
    private func getTodayDateInt() -> Int {
        let calendar = Calendar.current
        let now = Date()
        let year = calendar.component(.year, from: now)
        let month = calendar.component(.month, from: now)
        let day = calendar.component(.day, from: now)
        return year * 10000 + month * 100 + day
    }
}

// MARK: - Data Models

/// Represents today's athkar completion status
struct AthkarCompletionData {
    let morningCompleted: Bool
    let eveningCompleted: Bool
    let date: Int

    var bothCompleted: Bool {
        morningCompleted && eveningCompleted
    }

    var neitherCompleted: Bool {
        !morningCompleted && !eveningCompleted
    }

    var completionCount: Int {
        (morningCompleted ? 1 : 0) + (eveningCompleted ? 1 : 0)
    }
}

/// Represents athkar streak data
struct AthkarStreakData {
    let currentStreak: Int
    let longestStreak: Int
    let lastStreakDate: Int?  // YYYYMMDD format
    let isPaused: Bool
}
