import ActivityKit
import UserNotifications
#if canImport(UIKit)
import UIKit
#endif

#if canImport(AlarmKit)
import AlarmKit
import AppIntents
#endif

@objc public class AlarmObserver: NSObject {
    private static let stateLock = NSLock()
    static let bypassNotificationIds = (0..<5).map { "bypass-\($0)" }
    private static var isObserving = false
    private static var observerTask: Task<Void, Never>?
    private static var heartbeatTask: Task<Void, Never>?
    private static var backgroundTaskID: UIBackgroundTaskIdentifier = .invalid

    @objc public static func startObserving() {
        #if canImport(AlarmKit)
        if #available(iOS 26.1, *) {
            stateLock.lock()
            guard !isObserving else {
                stateLock.unlock()
                PersistentLog.shared.observer("Already observing, skipping restart")
                return
            }
            isObserving = true
            stateLock.unlock()

            startHeartbeat()

            let task = Task {
                let plog = PersistentLog.shared
                var previousAlarms: [UUID: Alarm.State] = [:]
                var isFirstIteration = true

                plog.observer("Observer started, keepAlive=\(AlarmAudioManager.shared.isKeepAliveRunning())")

                for await alarms in AlarmManager.shared.alarmUpdates {
                    let currentAlarms = Dictionary(uniqueKeysWithValues: alarms.map { ($0.id, $0.state) })

                    plog.observer("Update: \(alarms.count) alarm(s), first=\(isFirstIteration)")
                    for alarm in alarms {
                        plog.observer("  \(alarm.id.uuidString.prefix(8))... = \(alarm.state)")
                    }

                    if isFirstIteration {
                        isFirstIteration = false
                        await processFirstIteration(alarms: alarms)
                    }

                    await processAlarmTransitions(alarms: alarms, previousAlarms: previousAlarms)

                    previousAlarms = currentAlarms
                }

                plog.observer("Observer ended")
            }
            stateLock.lock()
            observerTask = task
            stateLock.unlock()
        }
        #endif
    }

    @objc public static func stopObserving() {
        stateLock.lock()
        heartbeatTask?.cancel()
        heartbeatTask = nil
        observerTask?.cancel()
        observerTask = nil
        isObserving = false
        stateLock.unlock()
        PersistentLog.shared.observer("Observer stopped")
    }

    @objc public static func endBackgroundTask() {
        stateLock.lock()
        let taskId = backgroundTaskID
        backgroundTaskID = .invalid
        stateLock.unlock()
        if taskId != .invalid {
            UIApplication.shared.endBackgroundTask(taskId)
        }
    }

    // MARK: - Heartbeat

    private static func startHeartbeat() {
        stateLock.lock()
        heartbeatTask?.cancel()
        stateLock.unlock()
        let task = Task {
            let plog = PersistentLog.shared
            var beatCount = 0

            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                guard !Task.isCancelled else { break }

                beatCount += 1
                let keepAlive = AlarmAudioManager.shared.isKeepAliveRunning()
                let audioPlaying = AlarmAudioManager.shared.isCurrentlyPlaying()

                var alarmStates: [String] = []
                if #available(iOS 26.1, *) {
                    if let alarms = try? AlarmManager.shared.alarms {
                        for alarm in alarms {
                            alarmStates.append("\(alarm.id.uuidString.prefix(4))=\(alarm.state)")
                        }
                    }
                }

                plog.observer("Heartbeat #\(beatCount) keepAlive=\(keepAlive) audio=\(audioPlaying) [\(alarmStates.joined(separator: ","))]")
            }
        }
        stateLock.lock()
        heartbeatTask = task
        stateLock.unlock()
    }

    // MARK: - First Iteration Processing

    #if canImport(AlarmKit)
    @available(iOS 26.1, *)
    private static func processFirstIteration(alarms: [Alarm]) async {
        let plog = PersistentLog.shared

        await detectMissedDismissals(alarms: alarms)

        for alarm in alarms {
            if alarm.state == .alerting {
                plog.observer("Already alerting on startup: \(alarm.id.uuidString.prefix(8))")
                if !AlarmAudioManager.shared.isKeepAliveRunning() {
                    AlarmAudioManager.shared.startQuietKeepAlive()
                }
                await handleAlarmAlerting(alarmId: alarm.id.uuidString.lowercased())
            }
        }

        if let bypassState = AlarmDatabase.shared.getBypassState() {
            let elapsed = Date().timeIntervalSince1970 - bypassState.activatedAt
            let staleThreshold: TimeInterval = 30 * 60
            plog.observer("Bypass state found: \(bypassState.alarmId.prefix(8)) (active \(Int(elapsed))s ago)")

            if elapsed > staleThreshold {
                plog.observer("Bypass state is stale (\(Int(elapsed))s > \(Int(staleThreshold))s), clearing")
                AlarmDatabase.shared.clearBypassState()
            } else if !AlarmDatabase.shared.isCompleted(id: bypassState.alarmId) {
                plog.observer("Challenge NOT completed, re-triggering bypass")
                await handleAlarmDismissed(alarmId: bypassState.alarmId)
            } else {
                plog.observer("Challenge completed while dead, clearing bypass state")
                AlarmDatabase.shared.clearBypassState()
            }
        }
    }

    @available(iOS 26.1, *)
    private static func detectMissedDismissals(alarms: [Alarm]) async {
        let plog = PersistentLog.shared
        let dbAlarmIds = AlarmDatabase.shared.getAllAlarmIds()
        let alarmKitIds = Set(alarms.map { $0.id.uuidString.lowercased() })
        let now = Date().timeIntervalSince1970 * 1000

        plog.observer("DB alarms: \(dbAlarmIds.count), AlarmKit: \(alarmKitIds.count)")

        let staleThresholdMs: Double = 2 * 60 * 60 * 1000 // 2 hours
        for dbId in dbAlarmIds {
            if !alarmKitIds.contains(dbId.lowercased()) {
                if let alarmInfo = AlarmDatabase.shared.getAlarm(id: dbId) {
                    if alarmInfo.triggerTime < now && !alarmInfo.completed {
                        let age = now - alarmInfo.triggerTime
                        if age > staleThresholdMs {
                            plog.observer("Stale alarm \(dbId.prefix(8)) (\(Int(age/1000))s old), cleaning up")
                            AlarmDatabase.shared.deleteAlarm(id: dbId)
                        } else {
                            plog.observer("Missed dismiss detected: \(dbId.prefix(8))")
                            await handleAlarmDismissed(alarmId: dbId)
                            AlarmDatabase.shared.deleteAlarm(id: dbId)
                        }
                    }
                }
            }
        }
    }

    // MARK: - State Transitions

    @available(iOS 26.1, *)
    private static func processAlarmTransitions(alarms: [Alarm], previousAlarms: [UUID: Alarm.State]) async {
        let plog = PersistentLog.shared
        let currentIds = Set(alarms.map { $0.id })
        let previousIds = Set(previousAlarms.keys)

        // Newly alerting
        for alarm in alarms {
            let previousState = previousAlarms[alarm.id]
            if alarm.state == .alerting && previousState != .alerting && previousState != nil {
                plog.observer("Alerting: \(alarm.id.uuidString.prefix(8))")
                if !AlarmAudioManager.shared.isKeepAliveRunning() {
                    AlarmAudioManager.shared.startQuietKeepAlive()
                }
                await handleAlarmAlerting(alarmId: alarm.id.uuidString.lowercased())
            }
        }

        // Disappeared (dismissed/stopped)
        let dismissedIds = previousIds.subtracting(currentIds)
        for alarmId in dismissedIds {
            let wasAlerting = previousAlarms[alarmId] == .alerting
            plog.observer("Gone: \(alarmId.uuidString.prefix(8)) wasAlerting=\(wasAlerting)")
            if wasAlerting {
                plog.observer("Dismissed (was alerting): \(alarmId.uuidString.prefix(8))")
                await handleAlarmDismissed(alarmId: alarmId.uuidString.lowercased())
            }
        }

        // Log state changes
        for alarm in alarms {
            let previousState = previousAlarms[alarm.id]
            if previousState == .alerting && alarm.state != .alerting {
                plog.observer("State change: alerting -> \(alarm.state)")
            }
        }
    }

    // MARK: - Bypass Backup

    @available(iOS 26.1, *)
    static func scheduleBypassBackup(
        originalAlarmId: String,
        alarmType: String,
        title: String,
        delay: TimeInterval = 15
    ) async -> UUID? {
        let plog = PersistentLog.shared

        let existingBackups = AlarmDatabase.shared.getBackupAlarmIds()
        for id in existingBackups {
            if let uuid = UUID(uuidString: id) {
                try? AlarmManager.shared.cancel(id: uuid)
            }
        }
        AlarmDatabase.shared.deleteAllBackups()

        let backupId = UUID()
        let backupTime = Date().addingTimeInterval(delay)

        do {
            let countdownDuration = Alarm.CountdownDuration(
                preAlert: delay,
                postAlert: 300
            )
            let stopButton = AlarmButton(
                text: LocalizedStringResource(stringLiteral: "Dismiss"),
                textColor: .white,
                systemImageName: "stop.circle.fill"
            )
            let alertPresentation = AlarmPresentation.Alert(
                title: LocalizedStringResource(stringLiteral: title),
                stopButton: stopButton
            )
            let countdownPresentation = AlarmPresentation.Countdown(
                title: LocalizedStringResource(stringLiteral: "Alarm in...")
            )
            let presentation = AlarmPresentation(
                alert: alertPresentation,
                countdown: countdownPresentation
            )
            let attributes = AlarmAttributes<NedaaAlarmMetadata>(
                presentation: presentation,
                tintColor: alarmType == "fajr" ? .orange : .green
            )
            let backupIntent = OpenNedaaAlarmIntent(
                alarmId: originalAlarmId,
                alarmType: alarmType,
                title: title
            )
            let config = AlarmManager.AlarmConfiguration(
                countdownDuration: countdownDuration,
                schedule: .fixed(backupTime),
                attributes: attributes,
                stopIntent: backupIntent,
                sound: .named("beep")
            )
            _ = try await AlarmManager.shared.schedule(id: backupId, configuration: config)

            AlarmDatabase.shared.saveAlarm(
                id: backupId.uuidString.lowercased(),
                alarmType: alarmType,
                title: title,
                triggerTime: backupTime.timeIntervalSince1970 * 1000,
                isBackup: true
            )
            plog.observer("Backup scheduled: \(backupId.uuidString.prefix(8)) in \(Int(delay))s")
            return backupId
        } catch {
            plog.observer("Backup scheduling failed: \(error.localizedDescription)")
            return nil
        }
    }

    // MARK: - Alarm Handlers

    @available(iOS 26.1, *)
    private static func handleAlarmAlerting(alarmId: String) async {
        let plog = PersistentLog.shared

        plog.observer("Alarm alerting: \(alarmId.prefix(8))")

        var metadata = AlarmDatabase.shared.getMetadata(for: alarmId)
        var originalAlarmId = alarmId

        if metadata == nil {
            if let pending = AlarmDatabase.shared.getPendingChallenge(),
               let pendingId = pending["alarmId"] as? String,
               let pendingType = pending["alarmType"] as? String,
               let pendingTitle = pending["title"] as? String {
                metadata = (alarmType: pendingType, title: pendingTitle)
                originalAlarmId = pendingId
                plog.observer("Using pending challenge metadata for backup")
            }
        }

        guard let metadata = metadata else {
            plog.observer("No metadata for alarm: \(alarmId)")
            return
        }

        // Start vibration immediately for backup alarms (they fire via AlarmKit,
        // but we want vibration to start while system alarm is showing)
        let backupIds = AlarmDatabase.shared.getBackupAlarmIds()
        if backupIds.contains(alarmId.lowercased()) {
            plog.observer("Backup alarm alerting - starting vibration")
            DispatchQueue.main.async {
                AlarmAudioManager.shared.startContinuousVibration()
            }
        }

        if AlarmDatabase.shared.isCompleted(id: originalAlarmId) {
            plog.observer("Already completed, skipping: \(originalAlarmId.prefix(8))")
            return
        }

        if AlarmDatabase.shared.getPendingChallenge() == nil {
            AlarmDatabase.shared.setPendingChallenge(
                alarmId: originalAlarmId,
                alarmType: metadata.alarmType,
                title: metadata.title
            )
        }

        _ = await startFiringLiveActivity(
            alarmId: originalAlarmId,
            alarmType: metadata.alarmType,
            title: metadata.title
        )

        if !AlarmAudioManager.shared.isKeepAliveRunning() {
            AlarmAudioManager.shared.startQuietKeepAlive()
        }

        if let url = URL(string: "dev.nedaa.app://alarm?alarmId=\(originalAlarmId)&alarmType=\(metadata.alarmType)") {
            await MainActor.run {
                UIApplication.shared.open(url)
            }
        }
    }

    @available(iOS 26.1, *)
    private static func handleAlarmDismissed(alarmId: String) async {
        let plog = PersistentLog.shared

        plog.observer("Dismissed: \(alarmId.prefix(8))")

        var originalAlarmId = alarmId
        if let pending = AlarmDatabase.shared.getPendingChallenge(),
           let pendingId = pending["alarmId"] as? String {
            originalAlarmId = pendingId
        }

        let isCompleted = AlarmDatabase.shared.isCompleted(id: originalAlarmId)

        if isCompleted {
            plog.observer("Challenge done, cleaning up")
            let backupIds = AlarmDatabase.shared.getBackupAlarmIds()
            for id in backupIds {
                if let uuid = UUID(uuidString: id) {
                    try? AlarmManager.shared.cancel(id: uuid)
                }
            }
            AlarmDatabase.shared.deleteAllBackups()
            AlarmDatabase.shared.clearBypassState()
            AlarmAudioManager.shared.stopAll()

            let center = UNUserNotificationCenter.current()
            center.removePendingNotificationRequests(withIdentifiers: bypassNotificationIds)
            return
        }

        plog.observer("Not completed — starting bypass protection")

        await MainActor.run {
            stateLock.lock()
            let oldTaskId = backgroundTaskID
            backgroundTaskID = .invalid
            stateLock.unlock()
            if oldTaskId != .invalid {
                UIApplication.shared.endBackgroundTask(oldTaskId)
            }

            let newTaskId = UIApplication.shared.beginBackgroundTask(withName: "AlarmBypassProtection") {
                plog.observer("BG task expired")
                stateLock.lock()
                let expiredTaskId = backgroundTaskID
                backgroundTaskID = .invalid
                stateLock.unlock()
                if expiredTaskId != .invalid {
                    UIApplication.shared.endBackgroundTask(expiredTaskId)
                }
            }
            stateLock.lock()
            backgroundTaskID = newTaskId
            stateLock.unlock()
        }

        let metadata = AlarmDatabase.shared.getMetadata(for: originalAlarmId)
        let alarmType = metadata?.alarmType ?? "prayer"

        // Get configured alarm settings
        let settingsKey = "alarm_settings_\(alarmType)"
        let settings = UserDefaults.standard.dictionary(forKey: settingsKey) ?? [:]
        let soundName = settings["sound"] as? String ?? "beep"
        let volume = Float(settings["volume"] as? Double ?? 1.0)

        AlarmAudioManager.shared.transitionToLoudAlarm(soundName: soundName, alarmVolume: volume)

        AlarmDatabase.shared.setBypassState(
            alarmId: originalAlarmId,
            alarmType: alarmType,
            title: metadata?.title ?? "Alarm"
        )

        let alarmTitle = metadata?.title ?? "Alarm"
        _ = await scheduleBypassBackup(
            originalAlarmId: originalAlarmId,
            alarmType: alarmType,
            title: alarmTitle,
            delay: 15
        )

        await scheduleBypassNotifications()

        await updateLiveActivityForDismiss(alarmId: originalAlarmId, metadata: metadata)
    }

    @available(iOS 26.1, *)
    private static func scheduleBypassNotifications() async {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: bypassNotificationIds)

        for i in 0..<5 {
            let content = UNMutableNotificationContent()
            content.title = "Complete challenge to dismiss"
            content.body = "Open Nedaa to dismiss your alarm"
            content.sound = .defaultCritical
            content.categoryIdentifier = "ALARM_BYPASS"
            content.interruptionLevel = .critical

            let trigger = UNTimeIntervalNotificationTrigger(
                timeInterval: TimeInterval(15 + (i * 15)),
                repeats: false
            )
            let request = UNNotificationRequest(
                identifier: "bypass-\(i)", content: content, trigger: trigger
            )
            try? await center.add(request)
        }
        PersistentLog.shared.observer("Bypass protection active: loud alarm + backup + 5 notifications")
    }
    #endif

    // MARK: - Live Activity Helpers

    @available(iOS 16.2, *)
    static func updateLiveActivityForDismiss(alarmId: String, metadata: (alarmType: String, title: String)?) async {
        let log = NativeLogger.shared

        var activityToUpdate: Activity<AlarmActivityAttributes>?

        for activity in Activity<AlarmActivityAttributes>.activities {
            if activity.attributes.alarmId == alarmId {
                activityToUpdate = activity
                break
            }
        }

        if activityToUpdate == nil {
            let alarmType = metadata?.alarmType ?? "prayer"
            let title = metadata?.title ?? "Alarm"

            let attributes = AlarmActivityAttributes(
                alarmId: alarmId,
                alarmType: alarmType,
                title: title,
                triggerTime: Date()
            )
            let state = AlarmActivityAttributes.ContentState(state: "firing")

            do {
                activityToUpdate = try Activity.request(
                    attributes: attributes,
                    content: .init(state: state, staleDate: nil),
                    pushType: nil
                )
            } catch {
                log.observerError("Failed to create Live Activity: \(error)")
                return
            }
        }

        guard let activity = activityToUpdate else { return }

        let newState = AlarmActivityAttributes.ContentState(state: "firing")

        let alertConfig = AlertConfiguration(
            title: "Complete challenge to dismiss",
            body: "Unlock device to dismiss alarm",
            sound: .default
        )

        await activity.update(
            ActivityContent(state: newState, staleDate: nil),
            alertConfiguration: alertConfig
        )
    }

    @available(iOS 16.2, *)
    static func startFiringLiveActivity(alarmId: String, alarmType: String, title: String) async -> String? {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            return nil
        }

        let existingCount = Activity<AlarmActivityAttributes>.activities.count
        if existingCount > 0 {
            for activity in Activity<AlarmActivityAttributes>.activities {
                let finalState = AlarmActivityAttributes.ContentState(state: "dismissed", remainingSeconds: nil)
                await activity.end(ActivityContent(state: finalState, staleDate: nil), dismissalPolicy: .immediate)
            }
            try? await Task.sleep(nanoseconds: 100_000_000)
        }

        let attributes = AlarmActivityAttributes(
            alarmId: alarmId,
            alarmType: alarmType,
            title: title,
            triggerTime: Date()
        )
        let state = AlarmActivityAttributes.ContentState(state: "firing")

        do {
            let activity = try Activity.request(
                attributes: attributes,
                content: .init(state: state, staleDate: nil),
                pushType: nil
            )
            return activity.id
        } catch {
            PersistentLog.shared.alarm("Failed to start Live Activity: \(error)")
            return nil
        }
    }
}
