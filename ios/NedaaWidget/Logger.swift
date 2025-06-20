import Foundation
import os.log

/// A logging utility for consistent logging across the application
enum LogLevel: String {
    case debug = "DEBUG"
    case info = "INFO"
    case warning = "WARNING"
    case error = "ERROR"
    case critical = "CRITICAL"
}

class Logger {
    private static let subsystem = "dev.nedaa.app"
    
    // OSLog categories
    private static let databaseLogger = OSLog(subsystem: subsystem, category: "Database")
    private static let prayerTimesLogger = OSLog(subsystem: subsystem, category: "PrayerTimes")
    private static let widgetLogger = OSLog(subsystem: subsystem, category: "Widget")
    
    /// Log a message with the specified level and category
    static func log(_ message: String, level: LogLevel, category: OSLog) {
        let logMessage = "[\(level.rawValue)] \(message)"
        
        switch level {
        case .debug:
            os_log("%{public}@", log: category, type: .debug, logMessage)
        case .info:
            os_log("%{public}@", log: category, type: .info, logMessage)
        case .warning:
            os_log("%{public}@", log: category, type: .default, logMessage)
        case .error:
            os_log("%{public}@", log: category, type: .error, logMessage)
        case .critical:
            os_log("%{public}@", log: category, type: .fault, logMessage)
        }
    }
    
    /// Log a database-related message
    static func database(_ message: String, level: LogLevel = .info) {
        log(message, level: level, category: databaseLogger)
    }
    
    /// Log a prayer times-related message
    static func prayerTimes(_ message: String, level: LogLevel = .info) {
        log(message, level: level, category: prayerTimesLogger)
    }
    
    /// Log a widget-related message
    static func widget(_ message: String, level: LogLevel = .info) {
        log(message, level: level, category: widgetLogger)
    }
}
