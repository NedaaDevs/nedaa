import Foundation
import WidgetKit
import Intents

// Data Structures

/// Single prayer data point with name and date
struct PrayerData: Decodable, Hashable {
    var name: String
    let date: Date
}

/// Prayer timings structure for database storage
struct PrayerTimings: Decodable {
    let fajr: String
    let dhuhr: String
    let asr: String
    let maghrib: String
    let isha: String
}

/// Other prayer-related timings stored in the database
struct OtherTimings: Decodable {
    let sunrise: String
    let sunset: String
    let imsak: String
    let midnight: String
    let firstthird: String
    let lastthird: String
}

// Widget Entry Types

/// Entry type for prayer countdown widgets
struct PrayerEntry: TimelineEntry {
    let date: Date
    let configuration: ConfigurationIntent
    let nextPrayer: PrayerData?
    let previousPrayer: PrayerData?
}

/// Entry type for all prayers widgets
struct AllPrayerEntry: TimelineEntry {
    let date: Date
    let configuration: ConfigurationIntent
    let allPrayers: [PrayerData]?
    let nextPrayer: PrayerData?
}

// Error Types

/// Error type for database operations
enum DatabaseError: Error {
    case openError(message: String)
    case queryError(message: String)
    case dataError(message: String)
    case migrationError(message: String)
    case schemaError(message: String)
    
    var localizedDescription: String {
        switch self {
        case .openError(let message):
            return "Database open error: \(message)"
        case .queryError(let message):
            return "Database query error: \(message)"
        case .dataError(let message):
            return "Database data error: \(message)"
        case .migrationError(let message):
            return "Database migration error: \(message)"
        case .schemaError(let message):
            return "Database schema error: \(message)"
        }
    }
}

/// Error type for prayer data operations
enum PrayerDataError: Error {
    case timezoneError(message: String)
    case dateError(message: String)
    case dataError(message: String)
    
    var localizedDescription: String {
        switch self {
        case .timezoneError(let message):
            return "Timezone error: \(message)"
        case .dateError(let message):
            return "Date error: \(message)"
        case .dataError(let message):
            return "Data error: \(message)"
        }
    }
}

// Helper Constants

/// Default prayer times for fallback
struct DefaultPrayerTimes {
    static func getTimes(for baseDate: Date = Date()) -> [PrayerData] {
        return [
            PrayerData(name: "fajr", date: Calendar.current.date(bySettingHour: 5, minute: 0, second: 0, of: baseDate)!),
            PrayerData(name: "sunrise", date: Calendar.current.date(bySettingHour: 6, minute: 30, second: 0, of: baseDate)!),
            PrayerData(name: "dhuhr", date: Calendar.current.date(bySettingHour: 12, minute: 0, second: 0, of: baseDate)!),
            PrayerData(name: "asr", date: Calendar.current.date(bySettingHour: 15, minute: 0, second: 0, of: baseDate)!),
            PrayerData(name: "maghrib", date: Calendar.current.date(bySettingHour: 18, minute: 0, second: 0, of: baseDate)!),
            PrayerData(name: "isha", date: Calendar.current.date(bySettingHour: 19, minute: 30, second: 0, of: baseDate)!)
        ]
    }
}

//  Helper Extensions

/// Extension to handle timezone conversions
extension Date {
    func toLocalTime(timezone: TimeZone) -> Date {
        let timezoneOffset = TimeInterval(timezone.secondsFromGMT(for: self))
        return self.addingTimeInterval(timezoneOffset)
    }
    
    /// Returns a formatted string representation of the date
    func formattedTime(format: String = "h:mm a") -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = format
        return formatter.string(from: self)
    }
}

/// Utility class for date operations
class DateUtils {
    /// Converts a date to YYYYMMDD integer format
    static func dateToInt(_ date: Date, in timeZone: TimeZone) -> Int {
        var calendar = Calendar.current
        calendar.timeZone = timeZone
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return (components.year ?? 0) * 10000 + (components.month ?? 0) * 100 + (components.day ?? 0)
    }
    
    /// Returns true if the date is Friday
    static func isFriday(_ date: Date) -> Bool {
        return Calendar.current.component(.weekday, from: date) == 6
    }
}
