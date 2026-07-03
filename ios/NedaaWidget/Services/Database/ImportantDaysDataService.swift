import Foundation
import SQLite3

/// One upcoming Islamic occasion. `id` drives the localized name and `dateISO`
/// (the occasion's Gregorian date) drives the natively-formatted Hijri label and
/// day count, so the widget renders in the device language like the others.
struct ImportantDayItem {
    let id: String
    let dateISO: String
    let sort: Int
}

/// Reads the occasions the JS layer writes into the shared `nedaa.db` (App Group
/// container) — the same table the Android widget reads.
class ImportantDaysDataService {
    private let appGroupId = "group.dev.nedaa.app"
    private let dbPath = "nedaa.db"
    private var db: OpaquePointer?

    private let importantDaysTable = "widget_important_days"

    private let maxRetries = 3
    private let retryDelay: TimeInterval = 0.5

    // MARK: - Public

    /// Upcoming occasions, soonest first. Empty when the app hasn't synced yet.
    func getUpcomingImportantDays() -> [ImportantDayItem] {
        var attempt = 0
        var result: [ImportantDayItem]? = nil

        while attempt < maxRetries && result == nil {
            if attempt > 0 {
                Thread.sleep(forTimeInterval: retryDelay * Double(attempt))
            }
            result = fetchImportantDays()
            attempt += 1
        }
        return result ?? []
    }

    /// Parses an ISO "yyyy-MM-dd" date to a `Date` at local midnight.
    static func date(fromISO dateISO: String) -> Date? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: dateISO)
    }

    /// Whole calendar days from today to `dateISO`; 0 = today. nil if unparseable.
    static func daysUntil(_ dateISO: String, from now: Date = Date()) -> Int? {
        guard let target = date(fromISO: dateISO) else { return nil }
        let calendar = Calendar.current
        return calendar.dateComponents(
            [.day],
            from: calendar.startOfDay(for: now),
            to: calendar.startOfDay(for: target)
        ).day
    }

    // MARK: - Private

    private func fetchImportantDays() -> [ImportantDayItem]? {
        do {
            try openDB()
            defer { closeDB() }

            var statement: OpaquePointer?
            defer { sqlite3_finalize(statement) }

            let query = "SELECT id, dateISO, sort FROM \(importantDaysTable) ORDER BY sort ASC"
            guard sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK else {
                let errmsg = String(cString: sqlite3_errmsg(db))
                Logger.database("Important Days: prepare failed: \(errmsg)", level: .error)
                return nil
            }

            var items: [ImportantDayItem] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                guard let id = sqlite3_column_text(statement, 0),
                      let iso = sqlite3_column_text(statement, 1) else { continue }
                items.append(
                    ImportantDayItem(
                        id: String(cString: id),
                        dateISO: String(cString: iso),
                        sort: Int(sqlite3_column_int(statement, 2))
                    )
                )
            }
            return items
        } catch {
            Logger.database("Important Days: fetch failed: \(error.localizedDescription)", level: .error)
            return nil
        }
    }

    private func openDB() throws {
        let fileManager = FileManager.default
        guard let directory = fileManager.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
            throw DatabaseError.openError(message: "Could not access app group container: \(appGroupId)")
        }

        let dbFile = directory.appendingPathComponent(dbPath)
        guard fileManager.fileExists(atPath: dbFile.path) else {
            throw DatabaseError.openError(message: "Database file does not exist at \(dbFile.path)")
        }

        if sqlite3_open(dbFile.path, &db) != SQLITE_OK {
            let errorMessage = db != nil ? String(cString: sqlite3_errmsg(db!)) : "Unknown error"
            if db != nil { sqlite3_close(db); db = nil }
            throw DatabaseError.openError(message: "Error opening database: \(errorMessage)")
        }
    }

    private func closeDB() {
        guard let database = db else { return }
        sqlite3_close(database)
        db = nil
    }
}
