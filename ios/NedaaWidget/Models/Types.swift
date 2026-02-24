import Foundation
import SwiftUI
import WidgetKit

#if canImport(AppIntents)
import AppIntents
#endif

// MARK: - Data Structures

/// Single prayer data point with name and date
struct PrayerData: Decodable, Hashable, Identifiable {
    var id: String { "\(name)-\(date.timeIntervalSince1970)" }
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

/// Entry type for Athkar widgets
struct AthkarEntry: TimelineEntry {
    let date: Date
    let progress: AthkarSummary?
}

// Error Types

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
            PrayerData(
                name: "fajr",
                date: Calendar.current.date(bySettingHour: 5, minute: 0, second: 0, of: baseDate)!),
            PrayerData(
                name: "sunrise",
                date: Calendar.current.date(bySettingHour: 6, minute: 30, second: 0, of: baseDate)!),
            PrayerData(
                name: "dhuhr",
                date: Calendar.current.date(bySettingHour: 12, minute: 0, second: 0, of: baseDate)!),
            PrayerData(
                name: "asr",
                date: Calendar.current.date(bySettingHour: 15, minute: 0, second: 0, of: baseDate)!),
            PrayerData(
                name: "maghrib",
                date: Calendar.current.date(bySettingHour: 18, minute: 0, second: 0, of: baseDate)!),
            PrayerData(
                name: "isha",
                date: Calendar.current.date(bySettingHour: 19, minute: 30, second: 0, of: baseDate)!
            ),
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

    var isRamadan: Bool {
        Calendar(identifier: .islamicUmmAlQura).component(.month, from: self) == 9
    }

    var ramadanDay: Int {
        Calendar(identifier: .islamicUmmAlQura).component(.day, from: self)
    }
}

/// Compute Smart Stack relevance based on proximity to next prayer time
func prayerTimelineRelevance(nextPrayerDate: Date?, previousPrayerDate: Date?, currentDate: Date) -> TimelineEntryRelevance? {
    if let prevDate = previousPrayerDate {
        let sincePrev = currentDate.timeIntervalSince(prevDate)
        if sincePrev >= 0 && sincePrev < 1800 {
            return TimelineEntryRelevance(score: 0.75, duration: 1800 - sincePrev)
        }
    }

    if let nextDate = nextPrayerDate {
        let toNext = nextDate.timeIntervalSince(currentDate)
        if toNext >= 0 && toNext <= 900 {
            return TimelineEntryRelevance(score: 1.0, duration: toNext + 1800)
        } else if toNext > 900 && toNext <= 1800 {
            return TimelineEntryRelevance(score: 0.75, duration: toNext)
        } else if toNext > 1800 && toNext <= 3600 {
            return TimelineEntryRelevance(score: 0.5, duration: toNext)
        }
    }

    return nil
}

/// Utility class for date operations
class DateUtils {
    /// Converts a date to YYYYMMDD integer format
    static func dateToInt(_ date: Date, in timeZone: TimeZone) -> Int {
        var calendar = Calendar.current
        calendar.timeZone = timeZone
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return (components.year ?? 0) * 10000 + (components.month ?? 0) * 100
            + (components.day ?? 0)
    }

    /// Returns true if the date is Friday
    static func isFriday(_ date: Date) -> Bool {
        return Calendar.current.component(.weekday, from: date) == 6
    }
}



// MARK: - Qada Data Models

/// Represents Qada fasts data
struct QadaFastData {
    let totalMissed: Int
    let totalCompleted: Int

    var totalOriginal: Int {
        totalMissed + totalCompleted
    }

    var completionPercentage: Int {
        guard totalOriginal > 0 else { return 0 }
        return Int((Double(totalCompleted) / Double(totalOriginal)) * 100)
    }

    var remaining: Int {
        totalMissed
    }
}

/// Summary of Qada fasts with today's progress
struct QadaSummary {
    let totalMissed: Int
    let totalCompleted: Int
    let todayCompleted: Int

    var totalFasts: Int {
        totalMissed + totalCompleted
    }

    var overallProgress: Double {
        guard totalFasts > 0 else { return 0 }
        return Double(totalCompleted) / Double(totalFasts)
    }
}

// MARK: - Athkar Types

/// Athkar progress data for widgets
struct AthkarProgressData {
    let totalItems: Int
    let completedItems: Int
    
    var progressPercentage: Int {
        guard totalItems > 0 else { return 0 }
        return Int((Double(completedItems) / Double(totalItems)) * 100)
    }
    
    var progress: Double {
        guard totalItems > 0 else { return 0 }
        return Double(completedItems) / Double(totalItems)
    }
    
    var isComplete: Bool {
        totalItems > 0 && completedItems == totalItems
    }
}

/// Complete summary of athkar data for widgets
struct AthkarSummary {
    let morningCompleted: Bool
    let eveningCompleted: Bool
    let currentStreak: Int
    let longestStreak: Int
    let totalItems: Int
    let completedItems: Int

    var bothCompleted: Bool {
        morningCompleted && eveningCompleted
    }

    var completionCount: Int {
        (morningCompleted ? 1 : 0) + (eveningCompleted ? 1 : 0)
    }

    var itemProgress: Double {
        guard totalItems > 0 else { return 0 }
        return Double(completedItems) / Double(totalItems)
    }

    var progressPercentage: Int {
        Int(itemProgress * 100)
    }

    var isComplete: Bool {
        totalItems > 0 && completedItems == totalItems
    }
}

// MARK: - App Intents Types

#if canImport(AppIntents)
@available(iOS 16.0, *)
// MARK: - Prayer Name Entity

/// Enum representing prayer names for Siri interaction
public enum PrayerNameEntity: String, AppEnum {
    case fajr
    case sunrise
    case dhuhr
    case asr
    case maghrib
    case isha
    case jumuah
    
    public static var typeDisplayRepresentation: TypeDisplayRepresentation {
        TypeDisplayRepresentation(name: "Prayer")
    }
    
    public static var caseDisplayRepresentations: [PrayerNameEntity: DisplayRepresentation] {
        [
            .fajr: DisplayRepresentation(
                title: LocalizedStringResource("fajr"),
                subtitle: LocalizedStringResource("dawn_prayer")
            ),
            .sunrise: DisplayRepresentation(
                title: LocalizedStringResource("sunrise"),
                subtitle: LocalizedStringResource("sunrise_time")
            ),
            .dhuhr: DisplayRepresentation(
                title: LocalizedStringResource("dhuhr"),
                subtitle: LocalizedStringResource("noon_prayer")
            ),
            .asr: DisplayRepresentation(
                title: LocalizedStringResource("asr"),
                subtitle: LocalizedStringResource("afternoon_prayer")
            ),
            .maghrib: DisplayRepresentation(
                title: LocalizedStringResource("maghrib"),
                subtitle: LocalizedStringResource("sunset_prayer")
            ),
            .isha: DisplayRepresentation(
                title: LocalizedStringResource("isha"),
                subtitle: LocalizedStringResource("night_prayer")
            ),
            .jumuah: DisplayRepresentation(
                title: LocalizedStringResource("jumuah"),
                subtitle: LocalizedStringResource("friday_prayer")
            )
        ]
    }
}
#endif
