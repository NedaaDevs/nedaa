import OSLog
import Foundation

@available(iOS 14.0, *)
class NativeLogger {
    static let shared = NativeLogger()

    private let alarmLogger = Logger(subsystem: "dev.nedaa.app", category: "Alarm")
    private let audioLogger = Logger(subsystem: "dev.nedaa.app", category: "Audio")
    private let intentLogger = Logger(subsystem: "dev.nedaa.app", category: "Intent")
    private let observerLogger = Logger(subsystem: "dev.nedaa.app", category: "Observer")
    private let trackerLogger = Logger(subsystem: "dev.nedaa.app", category: "Tracker")

    private init() {}

    func alarm(_ message: String) {
        alarmLogger.info("\(message, privacy: .public)")
    }

    func audio(_ message: String) {
        audioLogger.info("\(message, privacy: .public)")
    }

    func intent(_ message: String) {
        intentLogger.info("\(message, privacy: .public)")
    }

    func observer(_ message: String) {
        observerLogger.info("\(message, privacy: .public)")
    }

    func tracker(_ message: String) {
        trackerLogger.info("\(message, privacy: .public)")
    }

    func alarmError(_ message: String) {
        alarmLogger.error("\(message, privacy: .public)")
    }

    func audioError(_ message: String) {
        audioLogger.error("\(message, privacy: .public)")
    }

    func intentError(_ message: String) {
        intentLogger.error("\(message, privacy: .public)")
    }

    func observerError(_ message: String) {
        observerLogger.error("\(message, privacy: .public)")
    }

    func alarmWarning(_ message: String) {
        alarmLogger.warning("\(message, privacy: .public)")
    }

    func audioWarning(_ message: String) {
        audioLogger.warning("\(message, privacy: .public)")
    }
}

@available(iOS 15.0, *)
func exportNativeLogs() -> [[String: String]] {
    do {
        let store = try OSLogStore(scope: .currentProcessIdentifier)
        let oneHourAgo = Date().addingTimeInterval(-3600)
        let position = store.position(date: oneHourAgo)

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        return try store
            .getEntries(at: position)
            .compactMap { $0 as? OSLogEntryLog }
            .filter { $0.subsystem == "dev.nedaa.app" }
            .map { entry in
                let levelStr: String
                switch entry.level {
                case .debug: levelStr = "DEBUG"
                case .info: levelStr = "INFO"
                case .notice: levelStr = "NOTICE"
                case .error: levelStr = "ERROR"
                case .fault: levelStr = "FAULT"
                default: levelStr = "UNKNOWN"
                }

                return [
                    "timestamp": formatter.string(from: entry.date),
                    "category": entry.category,
                    "level": levelStr,
                    "message": entry.composedMessage
                ]
            }
    } catch {
        return [["error": "Failed to read logs: \(error.localizedDescription)"]]
    }
}
