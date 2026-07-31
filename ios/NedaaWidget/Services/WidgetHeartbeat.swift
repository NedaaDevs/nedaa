import Foundation

/// Records when a timeline provider last ran, in a file the containing app can
/// read. WidgetKit exposes no render callback, so a provider run is the only
/// evidence the app can observe that a reload reached the extension.
enum WidgetHeartbeat {
    private static let appGroupId = "group.dev.nedaa.app"
    private static let fileName = "widget-heartbeat"

    private static var fileURL: URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroupId)?
            .appendingPathComponent(fileName)
    }

    /// Stamps the current time in epoch milliseconds. Call from timeline
    /// functions only — placeholder and snapshot run in the widget gallery.
    static func stamp(kind: String) {
        guard let url = fileURL else { return }
        let millis = String(Int64(Date().timeIntervalSince1970 * 1000))
        do {
            // Lock Screen providers run on a locked device, where the default
            // protection class makes the write fail.
            try Data(millis.utf8).write(
                to: url,
                options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]
            )
            Logger.widget("heartbeat \(kind) \(millis)", level: .debug)
        } catch {
            Logger.widget("heartbeat write failed for \(kind): \(error)", level: .error)
        }
    }
}
