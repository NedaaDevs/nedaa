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
    private static var hasObservedInProcess = false
    // Matches ALARM_DEFAULTS.STALE_ALARM_THRESHOLD_MS on the JS side.
    private static let staleAlarmThresholdMs: Double = 2 * 60 * 60 * 1000
    private static let bypassStaleThreshold: TimeInterval = 30 * 60
    private static var observerTask: Task<Void, Never>?
    private static var heartbeatTask: Task<Void, Never>?
    private static var backgroundTaskID: UIBackgroundTaskIdentifier = .invalid
    // Ids the app removed itself; AlarmKit reports their removal like a user Stop.
    private static var expectedRemovals: Set<UUID> = []
    private static var backupTask: Task<UUID?, Never>?
    // Bumped when protection ends, so an in-flight backup knows it is stale.
    private static var bypassGeneration = 0

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
            // Dead-process bypass recovery runs once per process, never on a restart.
            let isProcessStart = !hasObservedInProcess
            hasObservedInProcess = true
            stateLock.unlock()

            startHeartbeat()

            stateLock.lock()
            observerTask = Task {
                let plog = PersistentLog.shared
                var previousAlarms: [UUID: Alarm.State] = [:]
                var silencedIds: Set<UUID> = []
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
                        silencedIds = await processFirstIteration(
                            alarms: alarms, isProcessStart: isProcessStart
                        )
                    }

                    await processAlarmTransitions(alarms: alarms, previousAlarms: previousAlarms)

                    // Kept out of history so a silenced alarm never reads as dismissed.
                    previousAlarms = currentAlarms.filter { !silencedIds.contains($0.key) }
                }

                plog.observer("Observer ended")
            }
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
        heartbeatTask = Task {
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
        stateLock.unlock()
    }

    // MARK: - First Iteration Processing

    #if canImport(AlarmKit)
    /// AlarmKit keeps an unanswered alarm alerting; a stale one stops silently.
    /// Returns those ids. JS completes and reschedules them on its stale check.
    @available(iOS 26.1, *)
    private static func processFirstIteration(alarms: [Alarm], isProcessStart: Bool) async -> Set<UUID> {
        let plog = PersistentLog.shared
        var silencedIds: Set<UUID> = []

        // Read before recovery, which can start a fresh bypass of its own.
        let bypassAtLaunch = AlarmDatabase.shared.getBypassState()
        await detectMissedDismissals(alarms: alarms)

        let now = Date().timeIntervalSince1970 * 1000
        for alarm in alarms where alarm.state == .alerting {
            let alarmId = alarm.id.uuidString.lowercased()
            if let stored = AlarmDatabase.shared.getAlarm(id: alarmId),
               now - stored.triggerTime > staleAlarmThresholdMs {
                plog.observer("Stale alerting on startup: \(alarmId.prefix(8)) (\(Int((now - stored.triggerTime) / 1000))s old), stopping silently")
                silencedIds.insert(alarm.id)
                do {
                    try AlarmManager.shared.stop(id: alarm.id)
                } catch {
                    plog.observer("Stale alarm stop failed: \(error.localizedDescription)")
                }
                continue
            }
            plog.observer("Already alerting on startup: \(alarmId.prefix(8))")
            await handleAlarmAlerting(alarmId: alarmId)
        }

        guard isProcessStart else { return silencedIds }

        if let bypassState = bypassAtLaunch {
            let elapsed = Date().timeIntervalSince1970 - bypassState.activatedAt
            plog.observer("Bypass state found: \(bypassState.alarmId.prefix(8)) (active \(Int(elapsed))s ago)")

            if elapsed > bypassStaleThreshold {
                plog.observer("Bypass state is stale (\(Int(elapsed))s > \(Int(bypassStaleThreshold))s), clearing")
                clearBypassState(ifNaming: bypassState.alarmId)
            } else if !AlarmDatabase.shared.isCompleted(id: bypassState.alarmId) {
                plog.observer("Challenge NOT completed, re-triggering bypass")
                await handleAlarmDismissed(alarmId: bypassState.alarmId)
            } else {
                plog.observer("Challenge completed while dead, clearing bypass state")
                clearBypassState(ifNaming: bypassState.alarmId)
            }
        }
        return silencedIds
    }

    @available(iOS 26.1, *)
    private static func detectMissedDismissals(alarms: [Alarm]) async {
        let plog = PersistentLog.shared
        let dbAlarmIds = AlarmDatabase.shared.getAllAlarmIds()
        let alarmKitIds = Set(alarms.map { $0.id.uuidString.lowercased() })
        let now = Date().timeIntervalSince1970 * 1000

        plog.observer("DB alarms: \(dbAlarmIds.count), AlarmKit: \(alarmKitIds.count)")

        for dbId in dbAlarmIds {
            if !alarmKitIds.contains(dbId.lowercased()) {
                if let alarmInfo = AlarmDatabase.shared.getAlarm(id: dbId) {
                    if alarmInfo.triggerTime < now {
                        let age = now - alarmInfo.triggerTime
                        if age > staleAlarmThresholdMs {
                            // Completed rows are collected here too. Nothing else deletes them,
                            // so every dismissed alarm would otherwise leave a row for good; the
                            // stale window still outlives the completed-alarm lookups that read them.
                            plog.observer("Stale alarm \(dbId.prefix(8)) (\(Int(age/1000))s old), cleaning up")
                            AlarmDatabase.shared.deleteAlarm(id: dbId)
                        } else if !alarmInfo.completed,
                                  age <= bypassStaleThreshold * 1000,
                                  AlarmDatabase.shared.getBypassState()?.alarmId != dbId {
                            // The row stays so the challenge can still mark it completed.
                            plog.observer("Missed dismiss detected: \(dbId.prefix(8))")
                            await handleAlarmDismissed(alarmId: dbId)
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
                await handleAlarmAlerting(alarmId: alarm.id.uuidString.lowercased())
            }
        }

        // Disappeared (dismissed/stopped)
        let dismissedIds = previousIds.subtracting(currentIds)
        for alarmId in dismissedIds {
            if consumeExpectedRemoval(alarmId) {
                plog.observer("Removed by app: \(alarmId.uuidString.prefix(8))")
                continue
            }
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
        // The stop intent and the observer both arm a backup for one Stop;
        // a second caller shares the backup already being scheduled.
        let (task, generation) = stateLock.withLock { () -> (Task<UUID?, Never>, Int) in
            if let running = backupTask { return (running, bypassGeneration) }
            let task = Task {
                await replaceBypassBackup(
                    originalAlarmId: originalAlarmId, alarmType: alarmType, title: title, delay: delay)
            }
            backupTask = task
            return (task, bypassGeneration)
        }
        let backupId = await task.value
        let isStale = stateLock.withLock { () -> Bool in
            if backupTask == task { backupTask = nil }
            return generation != bypassGeneration
        }
        // Protection ended while this backup was being scheduled.
        if isStale, let backupId {
            try? removeOwnAlarm(backupId)
            AlarmDatabase.shared.deleteAlarm(id: backupId.uuidString.lowercased())
            return nil
        }
        return backupId
    }

    @available(iOS 26.1, *)
    private static func replaceBypassBackup(
        originalAlarmId: String,
        alarmType: String,
        title: String,
        delay: TimeInterval
    ) async -> UUID? {
        let plog = PersistentLog.shared

        let existingBackups = AlarmDatabase.shared.getBackupAlarmIds()
        for id in existingBackups {
            if let uuid = UUID(uuidString: id) {
                try? removeOwnAlarm(uuid)
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
            let backupIntent = AlarmIntentFactory.stopIntent(
                alarmId: originalAlarmId,
                alarmType: alarmType,
                title: title
            )
            let alertSound: AlertConfiguration.AlertSound
            if let soundFile = alarmSoundFileName(for: alarmType) {
                alertSound = .named(soundFile)
            } else {
                alertSound = .default
            }
            // No schedule: preAlert already counts `delay` from now. A schedule as well
            // defers the countdown to that date and then runs preAlert again, ringing
            // the backup at twice the delay.
            let config = AlarmManager.AlarmConfiguration(
                countdownDuration: countdownDuration,
                attributes: attributes,
                stopIntent: backupIntent,
                sound: alertSound
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

    // AlarmKit matches an alert sound by file name in the app bundle, while the stored
    // setting holds an extension-less base name. Returns nil when no bundled file
    // matches, which leaves the system default alert sound in place.
    private static func alarmSoundFileName(for alarmType: String) -> String? {
        let settings = UserDefaults.standard.dictionary(forKey: "alarm_settings_\(alarmType)") ?? [:]
        return AlarmSoundResolver.fileName(named: settings["sound"] as? String ?? "")
    }

    @available(iOS 26.1, *)
    private static func handleAlarmAlerting(alarmId: String) async {
        let plog = PersistentLog.shared

        plog.observer("Alarm alerting: \(alarmId.prefix(8))")

        let isBackupAlarm = AlarmDatabase.shared.getBackupAlarmIds().contains(alarmId.lowercased())

        guard let owner = resolveOwner(of: alarmId) else {
            plog.observer("No owner for alarm: \(alarmId)")
            return
        }
        let originalAlarmId = owner.alarmId
        let metadata = (alarmType: owner.alarmType, title: owner.title)
        if originalAlarmId != alarmId.lowercased() {
            plog.observer("Resolved \(alarmId.prefix(8)) to original \(originalAlarmId.prefix(8))")
        }

        if AlarmDatabase.shared.isCompleted(id: originalAlarmId) {
            plog.observer("Already completed, skipping: \(originalAlarmId.prefix(8))")
            return
        }

        // Holds the process awake while the alarm rings; only for a live alarm.
        if !AlarmAudioManager.shared.isKeepAliveRunning() {
            AlarmAudioManager.shared.startQuietKeepAlive()
        }

        // Start vibration immediately for backup alarms (they fire via AlarmKit,
        // but we want vibration to start while system alarm is showing)
        if isBackupAlarm {
            plog.observer("Backup alarm alerting - starting vibration")
            DispatchQueue.main.async {
                AlarmAudioManager.shared.startContinuousVibration()
            }
        }

        if AlarmDatabase.shared.getPendingChallenge() == nil {
            AlarmDatabase.shared.setPendingChallenge(
                alarmId: originalAlarmId,
                alarmType: metadata.alarmType,
                title: metadata.title
            )
        }

        _ = await startFiringLiveActivity(alarmId: originalAlarmId)

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

        // The app's own cancels arrive here too; once completion has cleared
        // the pending challenge and bypass, they resolve to no owner.
        guard let owner = resolveOwner(of: alarmId) else {
            plog.observer("No owner for \(alarmId.prefix(8)), app-side cancel, ignoring")
            return
        }
        let originalAlarmId = owner.alarmId

        if AlarmDatabase.shared.isCompleted(id: originalAlarmId) {
            // A late event for a finished alarm must not end another one's bypass.
            if let active = activeProtectedAlarmId(), active != originalAlarmId {
                plog.observer("Done: \(originalAlarmId.prefix(8)), \(active.prefix(8)) still protected")
                return
            }
            // Audio here belongs to a bypass, or to a newly scheduled alarm's keep-alive.
            let hadBypass = AlarmDatabase.shared.getBypassState()?.alarmId == originalAlarmId
            plog.observer("Challenge done, cleaning up (bypass=\(hadBypass))")
            cleanUpBypass()
            if hadBypass { AlarmAudioManager.shared.stopAll() }
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

        // JS may complete the challenge while this handler is suspended.
        if AlarmDatabase.shared.isCompleted(id: originalAlarmId) {
            plog.observer("Completed before bypass started, cleaning up")
            cleanUpBypass()
            AlarmAudioManager.shared.stopAll()
            return
        }

        let alarmType = owner.alarmType
        let settingsKey = "alarm_settings_\(alarmType)"
        let settings = UserDefaults.standard.dictionary(forKey: settingsKey) ?? [:]
        let soundName = settings["sound"] as? String ?? "beep"
        let volume = Float(settings["volume"] as? Double ?? 1.0)

        AlarmAudioManager.shared.transitionToLoudAlarm(soundName: soundName, alarmVolume: volume)

        AlarmDatabase.shared.setBypassState(
            alarmId: originalAlarmId,
            alarmType: alarmType,
            title: owner.title
        )

        _ = await scheduleBypassBackup(
            originalAlarmId: originalAlarmId,
            alarmType: alarmType,
            title: owner.title,
            delay: 15
        )

        await scheduleBypassNotifications()

        if AlarmDatabase.shared.isCompleted(id: originalAlarmId) {
            plog.observer("Completed during bypass setup, cleaning up")
            cleanUpBypass()
            AlarmAudioManager.shared.stopAll()
            return
        }

        await updateLiveActivityForDismiss(alarmId: originalAlarmId)
    }

    /// The alarm an event belongs to: a scheduled alarm owns itself.
    /// A backup or removed row belongs to the pending challenge, then the bypass.
    @available(iOS 26.1, *)
    static func resolveOwner(of alarmId: String) -> (alarmId: String, alarmType: String, title: String)? {
        let id = alarmId.lowercased()
        let isBackup = AlarmDatabase.shared.getBackupAlarmIds().contains(id)
        if !isBackup, let alarm = AlarmDatabase.shared.getAlarm(id: id) {
            return (id, alarm.alarmType, alarm.title)
        }
        if let pending = AlarmDatabase.shared.getPendingChallenge(),
           let pendingId = pending["alarmId"] as? String,
           let pendingType = pending["alarmType"] as? String,
           let pendingTitle = pending["title"] as? String {
            return (pendingId, pendingType, pendingTitle)
        }
        if let bypass = AlarmDatabase.shared.getBypassState() {
            return (bypass.alarmId, bypass.alarmType, bypass.title)
        }
        return nil
    }

    /// Whether an alarm can still ring: scheduled under 2 h ago, or named by a
    /// fresh pending challenge or bypass. iOS can replay a stop intent hours late.
    static func isLive(alarmId: String) -> Bool {
        let id = alarmId.lowercased()
        let nowMs = Date().timeIntervalSince1970 * 1000
        if let alarm = AlarmDatabase.shared.getAlarm(id: id),
           (0...staleAlarmThresholdMs).contains(nowMs - alarm.triggerTime) {
            return true
        }
        if let pending = AlarmDatabase.shared.getPendingChallenge(),
           (pending["alarmId"] as? String) == id,
           let firedAt = pending["timestamp"] as? Double,
           nowMs - firedAt * 1000 <= staleAlarmThresholdMs {
            return true
        }
        if let bypass = AlarmDatabase.shared.getBypassState(), bypass.alarmId == id {
            return Date().timeIntervalSince1970 - bypass.activatedAt <= bypassStaleThreshold
        }
        return false
    }

    /// Cancels an alarm on the app's behalf. AlarmKit gives no reason for a
    /// removal, so the observer skips ids recorded here instead of re-arming.
    @available(iOS 26.1, *)
    static func removeOwnAlarm(_ id: UUID) throws {
        // An id AlarmKit no longer holds produces no removal event to consume.
        let isScheduled = (try? AlarmManager.shared.alarms)?.contains { $0.id == id } ?? true
        if isScheduled {
            stateLock.lock()
            expectedRemovals.insert(id)
            stateLock.unlock()
        }
        do {
            try AlarmManager.shared.cancel(id: id)
        } catch {
            stateLock.lock()
            expectedRemovals.remove(id)
            stateLock.unlock()
            throw error
        }
    }

    /// Alarm ids are deterministic, so a rescheduled id must not stay marked.
    static func forgetOwnRemoval(_ id: UUID) {
        stateLock.lock()
        expectedRemovals.remove(id)
        stateLock.unlock()
    }

    private static func consumeExpectedRemoval(_ id: UUID) -> Bool {
        stateLock.lock()
        defer { stateLock.unlock() }
        return expectedRemovals.remove(id) != nil
    }

    /// Protection is ending; a backup still being scheduled must not survive it.
    static func invalidateInFlightBackup() {
        stateLock.withLock { bypassGeneration += 1 }
    }

    /// The alarm whose challenge is outstanding, if any.
    static func activeProtectedAlarmId() -> String? {
        if let pendingId = AlarmDatabase.shared.getPendingChallenge()?["alarmId"] as? String {
            return pendingId
        }
        return AlarmDatabase.shared.getBypassState()?.alarmId
    }

    /// Recovery may have armed a newer bypass since the snapshot was read.
    private static func clearBypassState(ifNaming alarmId: String) {
        guard AlarmDatabase.shared.getBypassState()?.alarmId == alarmId else { return }
        AlarmDatabase.shared.clearBypassState()
    }

    /// Ends bypass protection: backups, bypass state, notifications.
    @available(iOS 26.1, *)
    private static func cleanUpBypass() {
        invalidateInFlightBackup()
        for id in AlarmDatabase.shared.getBackupAlarmIds() {
            if let uuid = UUID(uuidString: id) {
                try? removeOwnAlarm(uuid)
            }
        }
        AlarmDatabase.shared.deleteAllBackups()
        AlarmDatabase.shared.clearBypassState()
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: bypassNotificationIds)
    }

    @available(iOS 26.1, *)
    private static func scheduleBypassNotifications() async {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: bypassNotificationIds)

        for i in 0..<5 {
            let content = UNMutableNotificationContent()
            content.title = "Complete challenge to dismiss"
            content.body = "Open Nedaa to dismiss your alarm"
            // .critical needs an approved entitlement the app does not hold.
            content.sound = .default
            content.categoryIdentifier = "ALARM_BYPASS"
            content.interruptionLevel = .active

            let trigger = UNTimeIntervalNotificationTrigger(
                timeInterval: TimeInterval(15 + (i * 15)),
                repeats: false
            )
            let request = UNNotificationRequest(
                identifier: "bypass-\(i)", content: content, trigger: trigger
            )
            do {
                try await center.add(request)
            } catch {
                PersistentLog.shared.observer("Bypass notification \(i) failed: \(error)")
            }
        }
        PersistentLog.shared.observer("Bypass protection active: loud alarm + backup + 5 notifications")
    }
    #endif

    // MARK: - Live Activity Helpers

    @available(iOS 16.2, *)
    static func updateLiveActivityForDismiss(alarmId: String) async {
        let log = NativeLogger.shared

        var activityToUpdate: Activity<AlarmActivityAttributes>?

        for activity in Activity<AlarmActivityAttributes>.activities {
            if activity.attributes.alarmId == alarmId {
                activityToUpdate = activity
                break
            }
        }

        // ActivityKit rejects Activity.request from the background, and a firing alarm always
        // runs there, so the activity has to already exist from when the alarm was scheduled.
        guard let activity = activityToUpdate else {
            log.observerError("No Live Activity for \(alarmId) to escalate")
            PersistentLog.shared.observer("No Live Activity to escalate for \(alarmId.prefix(8))")
            return
        }

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
    /// Creates the alarm's Live Activity. Only legal while the app is foregrounded, which is
    /// why it runs at scheduling time rather than when the alarm fires.
    static func startScheduledLiveActivity(
        alarmId: String, alarmType: String, title: String, triggerTime: Date
    ) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            PersistentLog.shared.alarm("Live Activities disabled")
            return
        }

        await endAllLiveActivities()

        let attributes = AlarmActivityAttributes(
            alarmId: alarmId,
            alarmType: alarmType,
            title: title,
            triggerTime: triggerTime
        )
        let state = AlarmActivityAttributes.ContentState(state: "countdown", remainingSeconds: nil)

        do {
            _ = try Activity.request(
                attributes: attributes,
                content: .init(state: state, staleDate: triggerTime),
                pushType: nil
            )
            PersistentLog.shared.alarm("Live Activity started for \(alarmId.prefix(8))")
        } catch {
            PersistentLog.shared.alarm("Live Activity request failed: \(error)")
        }
    }

    /// Moves the alarm's Live Activity into the firing state and clears any others.
    ///
    /// A firing alarm runs in the background, where ActivityKit rejects `Activity.request`
    /// with `.visibility`, so this can only promote an activity that already exists. Alarms
    /// scheduled further out than the imminent window carry none.
    @available(iOS 16.2, *)
    static func startFiringLiveActivity(alarmId: String) async -> String? {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            PersistentLog.shared.alarm("Live Activities disabled")
            return nil
        }

        var firing: Activity<AlarmActivityAttributes>?
        for activity in Activity<AlarmActivityAttributes>.activities {
            if activity.attributes.alarmId == alarmId {
                firing = activity
            } else {
                let finalState = AlarmActivityAttributes.ContentState(state: "dismissed", remainingSeconds: nil)
                await activity.end(ActivityContent(state: finalState, staleDate: nil), dismissalPolicy: .immediate)
            }
        }

        guard let activity = firing else {
            PersistentLog.shared.alarm("No Live Activity to fire for \(alarmId.prefix(8))")
            return nil
        }

        let state = AlarmActivityAttributes.ContentState(state: "firing", remainingSeconds: nil)
        await activity.update(ActivityContent(state: state, staleDate: nil))
        return activity.id
    }

    @available(iOS 16.2, *)
    private static func endAllLiveActivities() async {
        for activity in Activity<AlarmActivityAttributes>.activities {
            let finalState = AlarmActivityAttributes.ContentState(state: "dismissed", remainingSeconds: nil)
            await activity.end(ActivityContent(state: finalState, staleDate: nil), dismissalPolicy: .immediate)
        }
    }
}
