import ActivityKit
import UserNotifications

#if canImport(AlarmKit)
import AlarmKit
import AppIntents

/// Supplies the stop intent handed to AlarmKit when an alarm is scheduled.
///
/// The intent type itself is declared in the app target, not here. AppIntents metadata
/// extraction records an empty `mangledTypeName` for types compiled into this pod's static
/// library, and the system then cannot resolve the intent when the alarm's stop button runs.
/// The app registers its factory during launch; alarms scheduled before that carry no stop
/// intent and fall back to AlarmKit's built-in stop behaviour.
@available(iOS 26.1, *)
public enum AlarmIntentFactory {
    public static var makeStopIntent:
        ((_ alarmId: String, _ alarmType: String, _ title: String) -> (any LiveActivityIntent))?
    {
        didSet { PersistentLog.shared.alarm("Stop-intent factory registered") }
    }

    static func stopIntent(
        alarmId: String, alarmType: String, title: String
    ) -> (any LiveActivityIntent)? {
        guard let makeStopIntent else {
            PersistentLog.shared.alarm("No stop-intent factory registered")
            return nil
        }
        let intent = makeStopIntent(alarmId, alarmType, title)
        PersistentLog.shared.alarm("Stop intent built: \(String(reflecting: type(of: intent)))")
        return intent
    }
}

/// The work the alarm's stop button performs: record the challenge, arm a bypass backup so a
/// silenced alarm still rings, and escalate the Live Activity.
@available(iOS 26.1, *)
public enum AlarmStopIntentHandler {
    public static func run(alarmId: String, alarmType: String, alarmTitle: String) async {
        let log = NativeLogger.shared
        let plog = PersistentLog.shared

        // The process name distinguishes the app resolving the intent from the widget
        // extension, which is the open question behind the "could not find an intent" errors.
        plog.intent(
            "Stop intent ran in \(ProcessInfo.processInfo.processName): "
                + "\(alarmId.prefix(8)) type=\(alarmType)")
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
            bypassCenter.removePendingNotificationRequests(
                withIdentifiers: AlarmObserver.bypassNotificationIds)

            plog.intent("Challenge completed, cleanup done")
            return
        }

        if pendingChallenge == nil {
            AlarmDatabase.shared.setPendingChallenge(
                alarmId: alarmId,
                alarmType: alarmType,
                title: alarmTitle
            )
        }

        let scheduledBackupId = await AlarmObserver.scheduleBypassBackup(
            originalAlarmId: alarmId,
            alarmType: alarmType,
            title: alarmTitle,
            delay: 15
        )

        // isCompleted was read before the backup was scheduled; JS may have completed
        // the challenge during that window. If so, tear the fresh backup back down so
        // it can't ring 15s after a successful dismissal.
        if AlarmDatabase.shared.isCompleted(id: alarmId) {
            if let scheduledBackupId {
                try? AlarmManager.shared.cancel(id: scheduledBackupId)
                AlarmDatabase.shared.deleteAlarm(id: scheduledBackupId.uuidString.lowercased())
            }
            AlarmDatabase.shared.clearBypassState()
            let center = UNUserNotificationCenter.current()
            center.removePendingNotificationRequests(
                withIdentifiers: AlarmObserver.bypassNotificationIds)
            plog.intent("Challenge completed during backup scheduling, backup cancelled")
            return
        }

        await updateLiveActivityWithSound(alarmId: alarmId)

        plog.intent("Intent complete")
    }

    private static func updateLiveActivityWithSound(alarmId: String) async {
        let log = NativeLogger.shared

        for activity in Activity<AlarmActivityAttributes>.activities
        where activity.attributes.alarmId == alarmId {
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

        log.intent("No matching Live Activity found to update")
    }
}
#endif
