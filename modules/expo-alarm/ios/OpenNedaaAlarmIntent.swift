import ActivityKit
import UserNotifications

#if canImport(AlarmKit)
import AlarmKit
import AppIntents

@available(iOS 26.1, *)
public struct OpenNedaaAlarmIntent: LiveActivityIntent {
    public static var title: LocalizedStringResource = "Open Nedaa Alarm"
    public static var description = IntentDescription("Opens Nedaa app to handle the alarm")
    public static var openAppWhenRun: Bool = true

    @Parameter(title: "Alarm ID")
    public var alarmId: String

    @Parameter(title: "Alarm Type")
    public var alarmType: String

    @Parameter(title: "Title")
    public var alarmTitle: String

    public init() {
        self.alarmId = ""
        self.alarmType = ""
        self.alarmTitle = "Alarm"
    }

    public init(alarmId: String, alarmType: String, title: String) {
        self.alarmId = alarmId
        self.alarmType = alarmType
        self.alarmTitle = title
    }

    public func perform() async throws -> some IntentResult {
        let log = NativeLogger.shared
        let plog = PersistentLog.shared

        plog.intent("Stop intent triggered: \(alarmId.prefix(8)) type=\(alarmType)")
        log.intent("Stop intent: \(alarmId), type=\(alarmType), title=\(alarmTitle)")

        let isCompleted = AlarmDatabase.shared.isCompleted(id: alarmId)
        let pendingChallenge = AlarmDatabase.shared.getPendingChallenge()

        if isCompleted {
            let existingBackups = AlarmDatabase.shared.getBackupAlarmIds()
            for id in existingBackups {
                if let uuid = UUID(uuidString: id) {
                    try? AlarmManager.shared.cancel(id: uuid)
                }
            }
            AlarmDatabase.shared.deleteAllBackups()
            AlarmDatabase.shared.clearBypassState()

            let bypassCenter = UNUserNotificationCenter.current()
            bypassCenter.removePendingNotificationRequests(withIdentifiers: (0..<5).map { "bypass-\($0)" })

            plog.intent("Challenge completed, cleanup done")
            return .result()
        }

        if pendingChallenge == nil {
            AlarmDatabase.shared.setPendingChallenge(
                alarmId: alarmId,
                alarmType: alarmType,
                title: alarmTitle
            )
        }

        _ = await AlarmObserver.scheduleBypassBackup(
            originalAlarmId: alarmId,
            alarmType: alarmType,
            title: alarmTitle,
            delay: 15
        )

        await updateLiveActivityWithSound()

        plog.intent("Intent complete")
        return .result()
    }

    private func updateLiveActivityWithSound() async {
        let log = NativeLogger.shared

        for activity in Activity<AlarmActivityAttributes>.activities {
            if activity.attributes.alarmId == alarmId {
                let newState = AlarmActivityAttributes.ContentState(
                    state: "firing",
                    remainingSeconds: nil
                )

                let alertConfig = AlertConfiguration(
                    title: "Complete challenge to dismiss",
                    body: "Unlock device to dismiss alarm",
                    sound: .default
                )

                await activity.update(
                    ActivityContent(state: newState, staleDate: nil),
                    alertConfiguration: alertConfig
                )

                log.intent("Live Activity updated with alert sound")
                return
            }
        }

        log.intent("No matching Live Activity found to update")
    }
}
#endif
