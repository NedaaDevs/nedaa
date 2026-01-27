import ActivityKit
import Foundation

/// Shared Live Activity attributes for alarm - used by both main app and widget extension
public struct AlarmActivityAttributes: ActivityAttributes, Codable {
    public struct ContentState: Codable, Hashable {
        public var state: String  // "countdown", "firing", "snoozed"
        public var remainingSeconds: Int?

        public init(state: String, remainingSeconds: Int? = nil) {
            self.state = state
            self.remainingSeconds = remainingSeconds
        }
    }

    public var alarmId: String
    public var alarmType: String
    public var title: String
    public var triggerTime: Date

    public init(alarmId: String, alarmType: String, title: String, triggerTime: Date) {
        self.alarmId = alarmId
        self.alarmType = alarmType
        self.title = title
        self.triggerTime = triggerTime
    }
}
