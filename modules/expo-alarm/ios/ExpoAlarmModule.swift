import ExpoModulesCore
import ActivityKit
import SQLite3
import UserNotifications
import BackgroundTasks

#if canImport(AlarmKit)
import AlarmKit
import AppIntents
#endif

// Module's own copy — widget uses ios/Shared/AlarmActivityAttributes.swift,
// but this pod can't access app target files directly
@available(iOS 16.2, *)
public struct AlarmActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var state: String
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

public class ExpoAlarmModule: Module {

    private var _scheduledAlarmIds: Set<String> = []
    private let alarmIdsLock = NSLock()

    private func withAlarmIds<T>(_ body: (inout Set<String>) -> T) -> T {
        alarmIdsLock.lock()
        defer { alarmIdsLock.unlock() }
        return body(&_scheduledAlarmIds)
    }

    public func definition() -> ModuleDefinition {
        Name("ExpoAlarm")

        Events("onPlaybackFinished")

        OnCreate {
            AlarmObserver.startObserving()

            if #available(iOS 13.0, *) {
                AlarmBackgroundTaskManager.shared.registerTask()
            }

            // Set up playback finished callback
            AlarmAudioManager.shared.onPlaybackFinished = { [weak self] in
                self?.sendEvent("onPlaybackFinished", [:])
            }
        }

        AsyncFunction("isAlarmKitAvailable") { () -> Bool in
            #if canImport(AlarmKit)
            if #available(iOS 26.1, *) {
                return true
            }
            #endif
            return false
        }

        Function("getBackgroundRefreshStatus") { () -> String in
            let status = UIApplication.shared.backgroundRefreshStatus
            switch status {
            case .available:
                return "available"
            case .denied:
                return "denied"
            case .restricted:
                return "restricted"
            @unknown default:
                return "unknown"
            }
        }

        AsyncFunction("requestAuthorization") { (promise: Promise) in
            self.resolveAuthorizationStatus(promise: promise)
        }

        AsyncFunction("getAuthorizationStatus") { (promise: Promise) in
            self.resolveAuthorizationStatus(promise: promise)
        }

        AsyncFunction("scheduleAlarm") { (
            id: String,
            triggerTimestamp: Double,
            title: String,
            alarmType: String,
            sound: String,
            dismissText: String,
            openText: String,
            promise: Promise
        ) in
            #if canImport(AlarmKit)
            if #available(iOS 26.1, *) {
                Task {
                    do {
                        let triggerDate = Date(timeIntervalSince1970: triggerTimestamp / 1000.0)
                        let secondsUntilAlarm = triggerDate.timeIntervalSince(Date())

                        PersistentLog.shared.alarm("Scheduling alarm \(id.prefix(8)) type=\(alarmType) in \(Int(secondsUntilAlarm))s")

                        let schedule = Alarm.Schedule.fixed(triggerDate)

                        let stopButton = AlarmButton(
                            text: LocalizedStringResource(stringLiteral: dismissText.isEmpty ? "Stop" : dismissText),
                            textColor: .white,
                            systemImageName: "stop.circle.fill"
                        )

                        let alertPresentation = AlarmPresentation.Alert(
                            title: LocalizedStringResource(stringLiteral: title),
                            stopButton: stopButton
                        )

                        let presentation = AlarmPresentation(
                            alert: alertPresentation
                        )

                        let attributes = AlarmAttributes<NedaaAlarmMetadata>(
                            presentation: presentation,
                            tintColor: alarmType == "fajr" ? .orange : .green
                        )

                        let stopIntent = OpenNedaaAlarmIntent(alarmId: id, alarmType: alarmType, title: title)

                        let config = AlarmManager.AlarmConfiguration.alarm(
                            schedule: schedule,
                            attributes: attributes,
                            stopIntent: stopIntent,
                            sound: .default
                        )

                        guard let alarmUUID = UUID(uuidString: id) else {
                            promise.reject("ERR_INVALID_UUID", "Invalid alarm ID: \(id)")
                            return
                        }
                        _ = try await AlarmManager.shared.schedule(id: alarmUUID, configuration: config)

                        self.withAlarmIds { $0.insert(id) }

                        AlarmDatabase.shared.saveAlarm(
                            id: id,
                            alarmType: alarmType,
                            title: title,
                            triggerTime: triggerTimestamp,
                            isBackup: false
                        )

                        AlarmDatabase.shared.clearCompleted(id: id)

                        AlarmBackgroundTaskManager.shared.scheduleWakeTask(
                            alarmTime: triggerDate,
                            alarmId: id
                        )

                        let keepAliveThreshold: TimeInterval = 10 * 60
                        if secondsUntilAlarm <= keepAliveThreshold {
                            AlarmAudioManager.shared.startQuietKeepAlive()
                            PersistentLog.shared.alarm("Keep-alive started (alarm < 10min)")

                            AlarmObserver.stopObserving()
                            AlarmObserver.startObserving()
                            PersistentLog.shared.alarm("Observer restarted for imminent alarm")
                        } else {
                            PersistentLog.shared.alarm("Keep-alive deferred to BGTask (alarm in \(Int(secondsUntilAlarm/60))min)")
                        }

                        PersistentLog.shared.alarm("Alarm scheduled successfully: \(id.prefix(8))")
                        promise.resolve(true)

                    } catch {
                        PersistentLog.shared.alarm("Schedule error: \(error.localizedDescription)")
                        promise.reject("SCHEDULE_ERROR", error.localizedDescription)
                    }
                }
                return
            }
            #endif
            promise.resolve(false)
        }

        AsyncFunction("cancelAlarm") { (id: String, promise: Promise) in
            #if canImport(AlarmKit)
            if #available(iOS 26.1, *) {
                Task {
                    do {
                        if let alarmId = UUID(uuidString: id) {
                            try AlarmManager.shared.cancel(id: alarmId)
                            self.withAlarmIds { $0.remove(id) }
                        }
                        if self.withAlarmIds({ $0.isEmpty }) {
                            AlarmAudioManager.shared.stopQuietKeepAlive()
                        }
                        promise.resolve(true)
                    } catch {
                        self.withAlarmIds { $0.remove(id) }
                        promise.resolve(true)
                    }
                }
                return
            }
            #endif
            promise.resolve(false)
        }

        AsyncFunction("cancelAllAlarms") { (promise: Promise) in
            #if canImport(AlarmKit)
            if #available(iOS 26.1, *) {
                Task {
                    let idsToCancel = self.withAlarmIds { Array($0) }
                    for id in idsToCancel {
                        if let alarmId = UUID(uuidString: id) {
                            try? AlarmManager.shared.cancel(id: alarmId)
                        }
                    }
                    self.withAlarmIds { $0.removeAll() }

                    let backupIds = AlarmDatabase.shared.getBackupAlarmIds()
                    for id in backupIds {
                        if let alarmId = UUID(uuidString: id) {
                            try? AlarmManager.shared.cancel(id: alarmId)
                        }
                    }
                    AlarmDatabase.shared.deleteAllBackups()

                    AlarmBackgroundTaskManager.shared.cancelWakeTask()
                    AlarmAudioManager.shared.stopQuietKeepAlive()

                    AlarmDatabase.shared.clearBypassState()
                    AlarmDatabase.shared.clearPendingChallenge()
                    let center = UNUserNotificationCenter.current()
                    center.removePendingNotificationRequests(withIdentifiers: AlarmObserver.bypassNotificationIds)

                    PersistentLog.shared.alarm("Cancelled all alarms, backups, BGTask, bypass, keep-alive")
                    promise.resolve(true)
                }
                return
            }
            #endif
            promise.resolve(nil)
        }

        Function("getScheduledAlarmIds") { () -> [String] in
            return self.withAlarmIds { Array($0) }
        }

        AsyncFunction("getAlarmKitAlarms") { (promise: Promise) in
            #if canImport(AlarmKit)
            if #available(iOS 26.1, *) {
                Task {
                    do {
                        let alarms = try AlarmManager.shared.alarms
                        var result: [[String: Any]] = []
                        for alarm in alarms {
                            var info: [String: Any] = [
                                "id": alarm.id.uuidString.lowercased(),
                                "state": String(describing: alarm.state)
                            ]
                            if let schedule = alarm.schedule {
                                switch schedule {
                                case .fixed(let date):
                                    info["triggerDate"] = date.timeIntervalSince1970 * 1000
                                    info["scheduleType"] = "fixed"
                                case .relative(let rel):
                                    info["scheduleType"] = "relative"
                                    info["hour"] = rel.time.hour
                                    info["minute"] = rel.time.minute
                                @unknown default:
                                    info["scheduleType"] = "unknown"
                                }
                            }
                            result.append(info)
                        }
                        promise.resolve(result)
                    } catch {
                        promise.resolve([])
                    }
                }
                return
            }
            #endif
            promise.resolve([])
        }

        Function("markAlarmCompleted") { (id: String) -> Bool in
            AlarmDatabase.shared.markCompleted(id: id)
            return true
        }

        Function("deleteAlarmFromDB") { (id: String) -> Bool in
            AlarmDatabase.shared.deleteAlarm(id: id)
            return true
        }

        AsyncFunction("startLiveActivity") { (
            alarmId: String,
            alarmType: String,
            title: String,
            triggerTimestamp: Double,
            promise: Promise
        ) in
            if #available(iOS 16.2, *) {
                guard ActivityAuthorizationInfo().areActivitiesEnabled else {
                    promise.resolve(nil)
                    return
                }

                for activity in Activity<AlarmActivityAttributes>.activities {
                    Task {
                        let finalState = AlarmActivityAttributes.ContentState(state: "dismissed", remainingSeconds: nil)
                        await activity.end(ActivityContent(state: finalState, staleDate: nil), dismissalPolicy: .immediate)
                    }
                }

                let triggerTime = Date(timeIntervalSince1970: triggerTimestamp / 1000.0)
                let attributes = AlarmActivityAttributes(
                    alarmId: alarmId,
                    alarmType: alarmType,
                    title: title,
                    triggerTime: triggerTime
                )
                let state = AlarmActivityAttributes.ContentState(state: "countdown", remainingSeconds: nil)

                do {
                    let activity = try Activity.request(
                        attributes: attributes,
                        content: .init(state: state, staleDate: triggerTime),
                        pushType: nil
                    )
                    promise.resolve(activity.id)
                } catch {
                    promise.reject("LIVE_ACTIVITY_ERROR", error.localizedDescription)
                }
            } else {
                promise.resolve(nil)
            }
        }

        AsyncFunction("updateLiveActivity") { (activityId: String, state: String, promise: Promise) in
            if #available(iOS 16.2, *) {
                Task {
                    let contentState = AlarmActivityAttributes.ContentState(state: state, remainingSeconds: nil)
                    if let activity = self.findActivity(id: activityId) {
                        await activity.update(using: contentState)
                        promise.resolve(true)
                    } else {
                        promise.resolve(false)
                    }
                }
            } else {
                promise.resolve(false)
            }
        }

        AsyncFunction("endLiveActivity") { (activityId: String, promise: Promise) in
            if #available(iOS 16.2, *) {
                Task {
                    if let activity = self.findActivity(id: activityId) {
                        await activity.end(nil, dismissalPolicy: .immediate)
                        promise.resolve(true)
                    } else {
                        promise.resolve(false)
                    }
                }
            } else {
                promise.resolve(false)
            }
        }

        AsyncFunction("endAllLiveActivities") { (promise: Promise) in
            if #available(iOS 16.2, *) {
                Task {
                    for activity in Activity<AlarmActivityAttributes>.activities {
                        await activity.end(nil, dismissalPolicy: .immediate)
                    }
                    promise.resolve(true)
                }
            } else {
                promise.resolve(false)
            }
        }

        AsyncFunction("getPendingChallenge") { () -> [String: Any]? in
            return AlarmDatabase.shared.getPendingChallenge()
        }

        AsyncFunction("clearPendingChallenge") { () -> Bool in
            AlarmDatabase.shared.clearPendingChallenge()
            return true
        }

        AsyncFunction("clearCompletedChallenges") { () -> Bool in
            AlarmDatabase.shared.clearAllCompleted()
            return true
        }

        AsyncFunction("cancelAllBackups") { (promise: Promise) in
            #if canImport(AlarmKit)
            if #available(iOS 26.1, *) {
                Task {
                    let backups = AlarmDatabase.shared.getBackupAlarmIds()
                    var cancelledCount = 0
                    for id in backups {
                        if let uuid = UUID(uuidString: id) {
                            do {
                                try AlarmManager.shared.cancel(id: uuid)
                                cancelledCount += 1
                            } catch {
                                PersistentLog.shared.alarm("Failed to cancel backup \(id.prefix(8)): \(error.localizedDescription)")
                            }
                        }
                    }
                    AlarmDatabase.shared.deleteAllBackups()
                    AlarmDatabase.shared.clearBypassState()

                    let center = UNUserNotificationCenter.current()
                    center.removePendingNotificationRequests(withIdentifiers: AlarmObserver.bypassNotificationIds)
                    PersistentLog.shared.alarm("Cancelled \(cancelledCount) backups, cleared bypass + notifications")

                    promise.resolve(cancelledCount)
                }
                return
            }
            #endif
            promise.resolve(0)
        }

        AsyncFunction("startAlarmSound") { (soundName: String) -> Bool in
            AlarmAudioManager.shared.startAlarmSound(soundName: soundName)
            return true
        }

        AsyncFunction("stopAlarmSound") { () -> Bool in
            AlarmAudioManager.shared.stopAlarmSound()
            return true
        }

        Function("isAlarmSoundPlaying") { () -> Bool in
            return AlarmAudioManager.shared.isCurrentlyPlaying()
        }

        Function("stopAllAlarmEffects") { () -> Bool in
            AlarmAudioManager.shared.stopAll()
            AlarmObserver.endBackgroundTask()
            return true
        }

        Function("setAlarmVolume") { (volume: Float) -> Bool in
            AlarmAudioManager.shared.setVolume(volume)
            return true
        }

        Function("getAlarmVolume") { () -> Float in
            return AlarmAudioManager.shared.getVolume()
        }

        AsyncFunction("getNativeLogs") { () -> [[String: String]] in
            if #available(iOS 15.0, *) {
                return exportNativeLogs()
            }
            return [["error": "Requires iOS 15+"]]
        }

        Function("getPersistentLog") { () -> String in
            return PersistentLog.shared.read()
        }

        Function("clearPersistentLog") { () -> Bool in
            PersistentLog.shared.clear()
            return true
        }

        Function("getNextAlarmTime") { () -> Double? in
            guard let nextTime = AlarmDatabase.shared.getNextAlarmTime() else {
                return nil
            }
            return nextTime.timeIntervalSince1970 * 1000
        }

        AsyncFunction("getAlarmSettings") { (alarmType: String) -> [String: Any] in
            return self.getAlarmSettings(alarmType)
        }

        AsyncFunction("setAlarmSettings") { (alarmType: String, settings: [String: Any]) -> Bool in
            self.saveAlarmSettings(alarmType, settings: settings)
            return true
        }

        Function("saveSystemVolume") { () -> Bool in
            AlarmAudioManager.shared.saveSystemVolume()
            return true
        }

        Function("restoreSystemVolume") { () -> Bool in
            AlarmAudioManager.shared.restoreSystemVolume()
            return true
        }

        AsyncFunction("getSystemAlarmSounds") { () -> [[String: String]] in
            // Return list of bundled iOS alarm ringtones
            // These are m4a files in the ios/alarm_sounds directory, added to the Xcode project bundle
            let ringtones: [[String: String]] = [
                ["id": "iOS-Alarm", "name": "Alarm", "isSystem": "true"],
                ["id": "iOS-Radar", "name": "Radar", "isSystem": "true"],
                ["id": "iOS-Beacon", "name": "Beacon", "isSystem": "true"],
                ["id": "iOS-Ascending", "name": "Ascending", "isSystem": "true"],
                ["id": "iOS-Chimes", "name": "Chimes", "isSystem": "true"],
                ["id": "iOS-Marimba", "name": "Marimba", "isSystem": "true"],
                ["id": "iOS-Signal", "name": "Signal", "isSystem": "true"],
                ["id": "iOS-Presto", "name": "Presto", "isSystem": "true"],
                ["id": "iOS-Stargaze", "name": "Stargaze", "isSystem": "true"],
                ["id": "iOS-Uplift", "name": "Uplift", "isSystem": "true"],
                ["id": "iOS-Ripples", "name": "Ripples", "isSystem": "true"],
                ["id": "iOS-Sencha", "name": "Sencha", "isSystem": "true"],
                ["id": "iOS-Daybreak-EncoreInfinitum", "name": "Daybreak", "isSystem": "true"],
                ["id": "iOS-Radial-EncoreInfinitum", "name": "Radial", "isSystem": "true"],
                ["id": "iOS-Reflection-EncoreInfinitum", "name": "Reflection", "isSystem": "true"]
            ]
            return ringtones
        }

    }

    // MARK: - Private Helpers

    private func resolveAuthorizationStatus(promise: Promise) {
        #if canImport(AlarmKit)
        if #available(iOS 26.1, *) {
            Task {
                do {
                    let status = try await AlarmManager.shared.requestAuthorization()
                    switch status {
                    case .authorized:
                        promise.resolve("authorized")
                    case .denied:
                        promise.resolve("denied")
                    case .notDetermined:
                        promise.resolve("notDetermined")
                    @unknown default:
                        promise.resolve("notDetermined")
                    }
                } catch {
                    promise.resolve("denied")
                }
            }
            return
        }
        #endif
        promise.resolve("denied")
    }

    @available(iOS 16.2, *)
    private func findActivity(id: String) -> Activity<AlarmActivityAttributes>? {
        return Activity<AlarmActivityAttributes>.activities.first { $0.id == id }
    }

    // MARK: - Alarm Settings (UserDefaults)

    private func getAlarmSettings(_ alarmType: String) -> [String: Any] {
        let key = "alarm_settings_\(alarmType)"
        if let saved = UserDefaults.standard.dictionary(forKey: key) {
            return saved
        }
        return [
            "enabled": false,
            "sound": "beep",
            "volume": 1.0,
            "challengeType": "tap",
            "challengeDifficulty": "easy",
            "challengeCount": 1,
            "gentleWakeUpEnabled": false,
            "gentleWakeUpDuration": 3,
            "vibrationEnabled": true,
            "vibrationPattern": "default",
            "snoozeEnabled": true,
            "snoozeMaxCount": 3,
            "snoozeDuration": 5
        ]
    }

    private func saveAlarmSettings(_ alarmType: String, settings: [String: Any]) {
        let key = "alarm_settings_\(alarmType)"
        var current = getAlarmSettings(alarmType)
        for (k, v) in settings {
            current[k] = v
        }
        UserDefaults.standard.set(current, forKey: key)
    }
}

#if canImport(AlarmKit)
@available(iOS 26.1, *)
public struct NedaaAlarmMetadata: AlarmMetadata {
    public init() {}
}
#endif
