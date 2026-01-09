import ExpoModulesCore
import ActivityKit
import SQLite3

#if canImport(AlarmKit)
import AlarmKit
import AppIntents
#endif

// MARK: - Shared Database Helper

private class AlarmDatabase {
    static let shared = AlarmDatabase()
    private let appGroupId = "group.dev.nedaa.app"
    private let dbPath = "nedaa.db"
    private let tableName = "alarms"

    private init() {
        createTableIfNeeded()
    }

    private func getDBPath() -> String? {
        guard let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
            return nil
        }
        return directory.appendingPathComponent(dbPath).path
    }

    private func createTableIfNeeded() {
        guard let path = getDBPath() else { return }
        var db: OpaquePointer?
        guard sqlite3_open(path, &db) == SQLITE_OK else { return }
        defer { sqlite3_close(db) }

        let sql = """
            CREATE TABLE IF NOT EXISTS \(tableName) (
                id TEXT PRIMARY KEY,
                alarm_type TEXT NOT NULL,
                title TEXT NOT NULL,
                trigger_time REAL NOT NULL,
                completed INTEGER DEFAULT 0,
                created_at REAL NOT NULL
            )
        """
        sqlite3_exec(db, sql, nil, nil, nil)
    }

    func saveAlarm(id: String, alarmType: String, title: String, triggerTime: Double) {
        guard let path = getDBPath() else { return }
        var db: OpaquePointer?
        guard sqlite3_open(path, &db) == SQLITE_OK else { return }
        defer { sqlite3_close(db) }

        let sql = """
            INSERT OR REPLACE INTO \(tableName)
            (id, alarm_type, title, trigger_time, completed, created_at)
            VALUES (?, ?, ?, ?, 0, ?)
        """
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
        defer { sqlite3_finalize(stmt) }

        sqlite3_bind_text(stmt, 1, id, -1, nil)
        sqlite3_bind_text(stmt, 2, alarmType, -1, nil)
        sqlite3_bind_text(stmt, 3, title, -1, nil)
        sqlite3_bind_double(stmt, 4, triggerTime)
        sqlite3_bind_double(stmt, 5, Date().timeIntervalSince1970 * 1000)
        sqlite3_step(stmt)
    }

    func markCompleted(id: String) {
        guard let path = getDBPath() else { return }
        var db: OpaquePointer?
        guard sqlite3_open(path, &db) == SQLITE_OK else { return }
        defer { sqlite3_close(db) }

        let sql = "UPDATE \(tableName) SET completed = 1 WHERE id = ?"
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
        defer { sqlite3_finalize(stmt) }

        sqlite3_bind_text(stmt, 1, id, -1, nil)
        sqlite3_step(stmt)
    }

    func deleteAlarm(id: String) {
        guard let path = getDBPath() else { return }
        var db: OpaquePointer?
        guard sqlite3_open(path, &db) == SQLITE_OK else { return }
        defer { sqlite3_close(db) }

        let sql = "DELETE FROM \(tableName) WHERE id = ?"
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
        defer { sqlite3_finalize(stmt) }

        sqlite3_bind_text(stmt, 1, id, -1, nil)
        sqlite3_step(stmt)
    }
}

// MARK: - Live Activity Attributes (must match widget extension)
struct AlarmActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var state: String
        var remainingSeconds: Int?
    }

    var alarmId: String
    var alarmType: String
    var title: String
    var triggerTime: Date
}

public class ExpoAlarmModule: Module {

    private var scheduledAlarmIds: Set<String> = []

    public func definition() -> ModuleDefinition {
        Name("ExpoAlarm")

        Events("onAlarmFired")

        // MARK: - Availability Check

        AsyncFunction("isAlarmKitAvailable") { () -> Bool in
            #if canImport(AlarmKit)
            if #available(iOS 26.1, *) {
                return true
            }
            #endif
            return false
        }

        // MARK: - Authorization

        AsyncFunction("requestAuthorization") { (promise: Promise) in
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
                        promise.reject("AUTH_ERROR", error.localizedDescription)
                    }
                }
                return
            }
            #endif
            promise.resolve("denied")
        }

        AsyncFunction("getAuthorizationStatus") { (promise: Promise) in
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

        // MARK: - Schedule Alarm

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

                        // Create fixed schedule for the alarm
                        let schedule = Alarm.Schedule.fixed(triggerDate)

                        // Create simple alert presentation
                        let alertPresentation = AlarmPresentation.Alert(
                            title: LocalizedStringResource(stringLiteral: title)
                        )

                        // Create attributes with presentation
                        let attributes = AlarmAttributes<NedaaAlarmMetadata>(
                            presentation: AlarmPresentation(alert: alertPresentation),
                            tintColor: alarmType == "fajr" ? .orange : .green
                        )

                        // Create intent to open app
                        let openIntent = OpenNedaaAlarmIntent(alarmId: id, alarmType: alarmType, title: title)

                        // Create configuration with stopIntent to open app on dismiss
                        let config = AlarmManager.AlarmConfiguration(
                            schedule: schedule,
                            attributes: attributes,
                            stopIntent: openIntent,
                            sound: .default
                        )

                        // Schedule the alarm
                        let alarmUUID = UUID(uuidString: id) ?? UUID()
                        _ = try await AlarmManager.shared.schedule(id: alarmUUID, configuration: config)

                        self.scheduledAlarmIds.insert(id)

                        // Save to shared DB for widget access
                        AlarmDatabase.shared.saveAlarm(
                            id: id,
                            alarmType: alarmType,
                            title: title,
                            triggerTime: triggerTimestamp
                        )

                        print("[ExpoAlarm] Scheduled: \(id) at \(triggerDate)")
                        promise.resolve(true)

                    } catch {
                        promise.reject("SCHEDULE_ERROR", error.localizedDescription)
                    }
                }
                return
            }
            #endif
            promise.resolve(false)
        }

        // MARK: - Cancel Alarm

        AsyncFunction("cancelAlarm") { (id: String, promise: Promise) in
            #if canImport(AlarmKit)
            if #available(iOS 26.1, *) {
                Task {
                    do {
                        if let alarmId = UUID(uuidString: id) {
                            try await AlarmManager.shared.stop(id: alarmId)
                            self.scheduledAlarmIds.remove(id)
                            print("[ExpoAlarm] Cancelled: \(id)")
                        }
                        promise.resolve(true)
                    } catch {
                        // Alarm might not exist (already fired) - that's OK
                        self.scheduledAlarmIds.remove(id)
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
                    // Cancel alarms tracked in module
                    let moduleCount = self.scheduledAlarmIds.count
                    for id in self.scheduledAlarmIds {
                        if let alarmId = UUID(uuidString: id) {
                            try? await AlarmManager.shared.stop(id: alarmId)
                        }
                    }
                    self.scheduledAlarmIds.removeAll()

                    // Cancel backup alarms tracked in UserDefaults
                    let backupCount = AlarmTracker.shared.getAll().count
                    for id in AlarmTracker.shared.getAll() {
                        if let alarmId = UUID(uuidString: id) {
                            try? await AlarmManager.shared.stop(id: alarmId)
                        }
                    }
                    AlarmTracker.shared.clear()

                    print("[ExpoAlarm] Cancelled all: \(moduleCount) module + \(backupCount) backups")
                    promise.resolve(true)
                }
                return
            }
            #endif
            promise.resolve(nil)
        }

        // MARK: - Get Scheduled Alarms

        Function("getScheduledAlarmIds") { () -> [String] in
            return Array(self.scheduledAlarmIds)
        }

        // MARK: - Mark Alarm Completed (for widget DB)

        Function("markAlarmCompleted") { (id: String) -> Bool in
            AlarmDatabase.shared.markCompleted(id: id)
            return true
        }

        Function("deleteAlarmFromDB") { (id: String) -> Bool in
            AlarmDatabase.shared.deleteAlarm(id: id)
            return true
        }

        // MARK: - Live Activity

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
                        content: .init(state: state, staleDate: nil),
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
                    for activity in Activity<AlarmActivityAttributes>.activities {
                        if activity.id == activityId {
                            await activity.update(using: contentState)
                            promise.resolve(true)
                            return
                        }
                    }
                    promise.resolve(false)
                }
            } else {
                promise.resolve(false)
            }
        }

        AsyncFunction("endLiveActivity") { (activityId: String, promise: Promise) in
            if #available(iOS 16.2, *) {
                Task {
                    for activity in Activity<AlarmActivityAttributes>.activities {
                        if activity.id == activityId {
                            await activity.end(nil, dismissalPolicy: .immediate)
                            promise.resolve(true)
                            return
                        }
                    }
                    promise.resolve(false)
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
    }
}

// MARK: - Alarm Metadata

#if canImport(AlarmKit)
@available(iOS 26.1, *)
public struct NedaaAlarmMetadata: AlarmMetadata {
    public init() {}
}
#endif

// MARK: - Scheduled Alarm Tracker (UserDefaults based for cross-process access)

private class AlarmTracker {
    static let shared = AlarmTracker()
    private let appGroupId = "group.dev.nedaa.app"
    private let key = "scheduledAlarmIds"

    private var userDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    func add(_ id: String) {
        var ids = getAll()
        ids.insert(id)
        userDefaults?.set(Array(ids), forKey: key)
    }

    func remove(_ id: String) {
        var ids = getAll()
        ids.remove(id)
        userDefaults?.set(Array(ids), forKey: key)
    }

    func getAll() -> Set<String> {
        let array = userDefaults?.stringArray(forKey: key) ?? []
        return Set(array)
    }

    func clear() {
        userDefaults?.set([String](), forKey: key)
    }
}

// MARK: - App Intent to Open App

#if canImport(AlarmKit)
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
        // Schedule backup alarm (15s) in case user kills app
        let backupId = UUID()
        let backupTime = Date().addingTimeInterval(15)

        do {
            let schedule = Alarm.Schedule.fixed(backupTime)
            let alertPresentation = AlarmPresentation.Alert(
                title: LocalizedStringResource(stringLiteral: alarmTitle)
            )
            let attributes = AlarmAttributes<NedaaAlarmMetadata>(
                presentation: AlarmPresentation(alert: alertPresentation),
                tintColor: alarmType == "fajr" ? .orange : .green
            )
            // Backup uses same alarmId in deep link
            let backupIntent = OpenNedaaAlarmIntent(alarmId: alarmId, alarmType: alarmType, title: alarmTitle)
            let config = AlarmManager.AlarmConfiguration(
                schedule: schedule,
                attributes: attributes,
                stopIntent: backupIntent,
                sound: .default
            )
            _ = try await AlarmManager.shared.schedule(id: backupId, configuration: config)
            AlarmTracker.shared.add(backupId.uuidString)
            print("[ExpoAlarm] Backup scheduled: \(backupId) in 15s")
        } catch {
            print("[ExpoAlarm] Backup failed: \(error.localizedDescription)")
        }

        // Open the app with deep link
        print("[ExpoAlarm] Opening app for alarm: \(alarmId)")
        if let url = URL(string: "dev.nedaa.app://alarm?alarmId=\(alarmId)&alarmType=\(alarmType)") {
            await MainActor.run {
                UIApplication.shared.open(url)
            }
        }
        return .result()
    }
}
#endif
