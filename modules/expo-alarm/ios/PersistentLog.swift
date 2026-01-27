import Foundation

class PersistentLog {
    static let shared = PersistentLog()
    private let appGroupId = "group.dev.nedaa.app"
    private let fileName = "alarm_debug.log"
    private let maxLines = 500

    private func getLogPath() -> URL? {
        guard let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
            return nil
        }
        return directory.appendingPathComponent(fileName)
    }

    func write(_ category: String, _ message: String) {
        guard let path = getLogPath() else { return }

        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss.SSS"
        let timestamp = formatter.string(from: Date())
        let line = "[\(timestamp)][\(category)] \(message)\n"

        if FileManager.default.fileExists(atPath: path.path) {
            if let handle = try? FileHandle(forWritingTo: path) {
                handle.seekToEndOfFile()
                if let data = line.data(using: .utf8) {
                    handle.write(data)
                }
                handle.closeFile()
            }
        } else {
            try? line.write(to: path, atomically: true, encoding: .utf8)
        }

        trimIfNeeded()
    }

    private func trimIfNeeded() {
        guard let path = getLogPath(),
              let content = try? String(contentsOf: path, encoding: .utf8) else { return }

        let lines = content.components(separatedBy: "\n")
        if lines.count > maxLines {
            let trimmed = lines.suffix(maxLines / 2).joined(separator: "\n")
            try? trimmed.write(to: path, atomically: true, encoding: .utf8)
        }
    }

    func read() -> String {
        guard let path = getLogPath() else { return "" }
        return (try? String(contentsOf: path, encoding: .utf8)) ?? ""
    }

    func clear() {
        guard let path = getLogPath() else { return }
        try? FileManager.default.removeItem(at: path)
    }

    func observer(_ msg: String) { write("OBS", msg) }
    func intent(_ msg: String) { write("INT", msg) }
    func audio(_ msg: String) { write("AUD", msg) }
    func alarm(_ msg: String) { write("ALM", msg) }
}
