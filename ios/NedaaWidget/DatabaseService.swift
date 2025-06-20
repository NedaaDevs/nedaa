import Foundation
import SQLite3

/// Database service for accessing prayer times from SQLite
class DatabaseService {
    private let appGroupId = "group.dev.nedaa.app"
    private let dbPath: String = "nedaa.db"
    
    let columnDate = "date"
    let columnTimezone = "timezone"
    let columnTimings = "timings"
    let columnOtherTimings = "other_timings"
    
    let prayerTimesTable = "prayer_times"
    
    private var db: OpaquePointer?
    
    var timeZone: String = ""
    
    // Timezone utilities
    func getTimezone(identifier: String) -> TimeZone {
        if let tz = TimeZone(identifier: identifier) {
            return tz
        } else {
            Logger.database("Invalid timezone identifier: \(identifier), using UTC", level: .warning)
            return TimeZone(secondsFromGMT: 0)!
        }
    }
    
    func currentDateInTimeZone(_ timezone: TimeZone) -> Date {
        let date = Date()
        var calendar = Calendar.current
        calendar.timeZone = timezone
        let components = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        return calendar.date(from: components) ?? date
    }
    
    // Converts date to YYYYMMDD integer format
    func dateToInt(_ date: Date, in timeZone: TimeZone) -> Int {
        return DateUtils.dateToInt(date, in: timeZone)
    }
    
    // Retry configuration
    private let maxRetries = 3
    private let retryDelay: TimeInterval = 0.5
    
    /// Database error types
    enum DatabaseError: Error {
        case openError(message: String)
        case queryError(message: String)
        case dataError(message: String)
        case schemaError(message: String)
    }
    
    /// Retrieves the timezone from the database with retry mechanism
    func getTimezone() {
        var attempt = 0
        var result: String? = nil
        
        while attempt < maxRetries && result == nil {
            if attempt > 0 {
                Logger.database("Retrying timezone query (attempt \(attempt+1)/\(maxRetries))", level: .info)
                Thread.sleep(forTimeInterval: retryDelay * Double(attempt))
            }
            
            let query = "SELECT \(columnTimezone) from \(prayerTimesTable) LIMIT 1"
            result = executeSingleStringQuery(query)
            attempt += 1
        }
        
        if let tzString = result {
            timeZone = tzString
            Logger.database("Retrieved timezone: \(tzString)", level: .info)
        } else {
            timeZone = ""
            Logger.database("Failed to retrieve timezone after \(maxRetries) attempts", level: .error)
        }
    }
    
    /// Gets prayer times for a specific date with retry mechanism
    /// - Parameter dateInt: Date in YYYYMMDD format
    /// - Returns: Array of PrayerData objects if successful, nil otherwise
    func getDayPrayerTimes(dateInt: Int) -> [PrayerData]? {
        var attempt = 0
        var result: PrayerTimingsResult? = nil
        
        while attempt < maxRetries && result == nil {
            if attempt > 0 {
                Logger.database("Retrying prayer times query (attempt \(attempt+1)/\(maxRetries)) for date \(dateInt)", level: .info)
                Thread.sleep(forTimeInterval: retryDelay * Double(attempt))
            }
            
            let query = "SELECT \(columnTimings), \(columnOtherTimings) FROM \(prayerTimesTable) WHERE \(columnDate) = ?"
            result = executePrayerTimesQuery(query, withParameter: Int32(dateInt))
            attempt += 1
        }
        
        guard let prayerTimings = result else {
            Logger.database("Failed to retrieve prayer times for date \(dateInt) after \(maxRetries) attempts", level: .error)
            return nil
        }
        
        // Convert the timings to PrayerData objects
        do {
            let prayerTimes = [
                PrayerData(name: "fajr", date: try convertStringToDate(timeString: prayerTimings.fajr)),
                PrayerData(name: "sunrise", date: try convertStringToDate(timeString: prayerTimings.sunrise)),
                PrayerData(name: "dhuhr", date: try convertStringToDate(timeString: prayerTimings.dhuhr)),
                PrayerData(name: "asr", date: try convertStringToDate(timeString: prayerTimings.asr)),
                PrayerData(name: "maghrib", date: try convertStringToDate(timeString: prayerTimings.maghrib)),
                PrayerData(name: "isha", date: try convertStringToDate(timeString: prayerTimings.isha))
            ]
            Logger.database("Successfully retrieved prayer times for date \(dateInt)", level: .info)
            return prayerTimes
        } catch {
            Logger.database("Error converting prayer times: \(error.localizedDescription)", level: .error)
            
            // Fallback to returning with default dates on error
            let prayerTimes = [
                PrayerData(name: "fajr", date: safeParseDate(prayerTimings.fajr)),
                PrayerData(name: "sunrise", date: safeParseDate(prayerTimings.sunrise)),
                PrayerData(name: "dhuhr", date: safeParseDate(prayerTimings.dhuhr)),
                PrayerData(name: "asr", date: safeParseDate(prayerTimings.asr)),
                PrayerData(name: "maghrib", date: safeParseDate(prayerTimings.maghrib)),
                PrayerData(name: "isha", date: safeParseDate(prayerTimings.isha))
            ]
            return prayerTimes
        }
    }
    
    /// Safe date parsing with fallback to current time
    private func safeParseDate(_ timeString: String) -> Date {
        do {
            return try convertStringToDate(timeString: timeString)
        } catch {
            Logger.database("Error parsing date string: \(timeString) - \(error.localizedDescription)", level: .warning)
            return Date()
        }
    }
    
    /// Executes a query that returns a single string value
    private func executeSingleStringQuery(_ query: String, withParameter parameter: Int32? = nil) -> String? {
        do {
            try openDB()
            defer { closeDB() }
            
            var statement: OpaquePointer?
            defer {
                sqlite3_finalize(statement)
            }
            
            if sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK {
                if let parameter = parameter {
                    sqlite3_bind_int(statement, 1, parameter)
                }
                
                if sqlite3_step(statement) == SQLITE_ROW {
                    guard let columnText = sqlite3_column_text(statement, 0) else {
                        Logger.database("Query returned no data: \(query)", level: .warning)
                        return nil
                    }
                    return String(cString: columnText)
                } else {
                    Logger.database("Query returned no rows: \(query)", level: .info)
                }
            } else {
                let errmsg = String(cString: sqlite3_errmsg(db)!)
                Logger.database("Error preparing query: \(query) - \(errmsg)", level: .error)
            }
            
            return nil
        } catch {
            Logger.database("Database error executing query: \(query) - \(error.localizedDescription)", level: .error)
            return nil
        }
    }
    
    /// Result type for prayer timings query
    private struct PrayerTimingsResult {
        let fajr: String
        let sunrise: String
        let dhuhr: String
        let asr: String
        let maghrib: String
        let isha: String
    }
    
    /// Executes a query that returns prayer timings data
    private func executePrayerTimesQuery(_ query: String, withParameter parameter: Int32? = nil) -> PrayerTimingsResult? {
        do {
            try openDB()
            defer { closeDB() }
            
            var statement: OpaquePointer?
            defer {
                sqlite3_finalize(statement)
            }
            
            if sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK {
                if let parameter = parameter {
                    sqlite3_bind_int(statement, 1, parameter)
                }
                
                if sqlite3_step(statement) == SQLITE_ROW {
                    // Check if we have both columns
                    if sqlite3_column_count(statement) < 2 {
                        throw DatabaseError.schemaError(message: "Missing expected columns in query result")
                    }
                    
                    guard let timingsText = sqlite3_column_text(statement, 0),
                          let otherTimingsText = sqlite3_column_text(statement, 1) else {
                        throw DatabaseError.dataError(message: "NULL data in prayer times columns")
                    }
                    
                    let timingsJson = String(cString: timingsText)
                    let otherTimingsJson = String(cString: otherTimingsText)
                    
                    guard let timingsData = timingsJson.data(using: .utf8),
                          let otherTimingsData = otherTimingsJson.data(using: .utf8) else {
                        throw DatabaseError.dataError(message: "Invalid UTF-8 data in prayer times")
                    }
                    
                    // Try to decode the JSON data
                    do {
                        let timings = try JSONDecoder().decode(PrayerTimings.self, from: timingsData)
                        let otherTimings = try JSONDecoder().decode(OtherTimings.self, from: otherTimingsData)
                        
                        return PrayerTimingsResult(
                            fajr: timings.fajr,
                            sunrise: otherTimings.sunrise,
                            dhuhr: timings.dhuhr,
                            asr: timings.asr,
                            maghrib: timings.maghrib,
                            isha: timings.isha
                        )
                    } catch {
                        Logger.database("JSON decoding error: \(error.localizedDescription)", level: .error)
                        Logger.database("Timings JSON: \(timingsJson)", level: .debug)
                        Logger.database("Other timings JSON: \(otherTimingsJson)", level: .debug)
                        throw DatabaseError.dataError(message: "Failed to decode prayer timings JSON: \(error.localizedDescription)")
                    }
                } else {
                    Logger.database("No prayer times found for query: \(query)", level: .info)
                }
            } else {
                let errmsg = String(cString: sqlite3_errmsg(db)!)
                throw DatabaseError.queryError(message: "Error preparing query: \(errmsg)")
            }
            
            return nil
        } catch {
            Logger.database("Error executing prayer times query: \(error.localizedDescription)", level: .error)
            return nil
        }
    }
    
    /// Converts ISO string to Date with better error handling
    /// - Parameter timeString: ISO 8601 date string
    /// - Returns: Parsed Date object
    /// - Throws: Error if parsing fails
    func convertStringToDate(timeString: String) throws -> Date {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        
        guard let date = dateFormatter.date(from: timeString) else {
            // Try alternate format
            dateFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
            if let date = dateFormatter.date(from: timeString) {
                return date
            }
            
            throw DatabaseError.dataError(message: "Invalid date format: \(timeString)")
        }
        
        return date
    }
    
    /// Checks if the database schema is valid
    /// - Returns: True if the schema is valid, false otherwise
    func validateSchema() -> Bool {
        do {
            try openDB()
            defer { closeDB() }
            
            var statement: OpaquePointer?
            let query = "PRAGMA table_info(\(prayerTimesTable))"
            
            defer {
                sqlite3_finalize(statement)
            }
            
            if sqlite3_prepare_v2(db, query, -1, &statement, nil) != SQLITE_OK {
                let errmsg = String(cString: sqlite3_errmsg(db)!)
                Logger.database("Error getting table info: \(errmsg)", level: .error)
                return false
            }
            
            var hasDate = false
            var hasTimezone = false
            var hasTimings = false
            var hasOtherTimings = false
            
            while sqlite3_step(statement) == SQLITE_ROW {
                if let columnName = sqlite3_column_text(statement, 1) {
                    let name = String(cString: columnName)
                    switch name {
                    case columnDate:
                        hasDate = true
                    case columnTimezone:
                        hasTimezone = true
                    case columnTimings:
                        hasTimings = true
                    case columnOtherTimings:
                        hasOtherTimings = true
                    default:
                        break
                    }
                }
            }
            
            let isValid = hasDate && hasTimezone && hasTimings && hasOtherTimings
            if !isValid {
                let missingColumns = [
                    hasDate ? nil : columnDate,
                    hasTimezone ? nil : columnTimezone,
                    hasTimings ? nil : columnTimings,
                    hasOtherTimings ? nil : columnOtherTimings
                ].compactMap { $0 }
                
                Logger.database("Invalid schema: missing columns \(missingColumns.joined(separator: ", "))", level: .error)
            }
            
            return isValid
        } catch {
            Logger.database("Error validating schema: \(error.localizedDescription)", level: .error)
            return false
        }
    }
    
    /// Opens a connection to the database with better error handling
    /// - Returns: True if the database was opened successfully
    /// - Throws: DatabaseError if there's an error
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
            
            // Clean up database handle even on failure
            if db != nil {
                sqlite3_close(db)
                db = nil
            }
            
            throw DatabaseError.openError(message: message)
        }
        
        Logger.database("Successfully opened database at \(dbFile.path)", level: .debug)
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
        
        // Always set db to nil after closing
        db = nil
    }
}
