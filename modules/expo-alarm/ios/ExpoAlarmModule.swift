import ExpoModulesCore

#if canImport(AlarmKit)
import AlarmKit
import AppIntents
#endif

public class ExpoAlarmModule: Module {

    private var scheduledAlarmIds: Set<String> = []

    public func definition() -> ModuleDefinition {
        Name("ExpoAlarm")

        Events("onAlarmFired")

        // MARK: - Availability Check

        AsyncFunction("isAlarmKitAvailable") { () -> Bool in
            #if canImport(AlarmKit)
            if #available(iOS 26.0, *) {
                return true
            }
            #endif
            return false
        }

        // MARK: - Authorization

        AsyncFunction("requestAuthorization") { (promise: Promise) in
            #if canImport(AlarmKit)
            if #available(iOS 26.0, *) {
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
            if #available(iOS 26.0, *) {
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
            if #available(iOS 26.0, *) {
                Task {
                    do {
                        let triggerDate = Date(timeIntervalSince1970: triggerTimestamp / 1000.0)

                        // Create fixed schedule for the alarm
                        let schedule = Alarm.Schedule.fixed(triggerDate)

                        // Create stop button with dynamic text
                        let stopButton = AlarmButton(
                            text: LocalizedStringResource(stringLiteral: dismissText ?? "Dismiss"),
                            textColor: .white,
                            systemImageName: "stop.circle.fill"
                        )

                        // Create open app button with dynamic text
                        let openButton = AlarmButton(
                            text: LocalizedStringResource(stringLiteral: openText ?? "Open"),
                            textColor: .white,
                            systemImageName: "arrow.right.circle.fill"
                        )

                        // Create alert presentation with secondary button
                        let alertPresentation = AlarmPresentation.Alert(
                            title: LocalizedStringResource(stringLiteral: title),
                            stopButton: stopButton,
                            secondaryButton: openButton,
                            secondaryButtonBehavior: .custom
                        )

                        // Create attributes with presentation
                        let attributes = AlarmAttributes<NedaaAlarmMetadata>(
                            presentation: AlarmPresentation(alert: alertPresentation),
                            tintColor: alarmType == "fajr" ? .orange : .green
                        )

                        // Create intent to open app
                        let openIntent = OpenNedaaAlarmIntent(alarmId: id, alarmType: alarmType)

                        // Create configuration with secondary intent
                        let config = AlarmManager.AlarmConfiguration(
                            schedule: schedule,
                            attributes: attributes,
                            secondaryIntent: openIntent,
                            sound: .default
                        )

                        // Schedule the alarm
                        let alarmId = UUID(uuidString: id) ?? UUID()
                        _ = try await AlarmManager.shared.schedule(id: alarmId, configuration: config)

                        self.scheduledAlarmIds.insert(id)
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
            if #available(iOS 26.0, *) {
                Task {
                    do {
                        if let alarmId = UUID(uuidString: id) {
                            try await AlarmManager.shared.stop(id: alarmId)
                            self.scheduledAlarmIds.remove(id)
                        }
                        promise.resolve(true)
                    } catch {
                        promise.reject("CANCEL_ERROR", error.localizedDescription)
                    }
                }
                return
            }
            #endif
            promise.resolve(false)
        }

        AsyncFunction("cancelAllAlarms") { (promise: Promise) in
            #if canImport(AlarmKit)
            if #available(iOS 26.0, *) {
                Task {
                    do {
                        for id in self.scheduledAlarmIds {
                            if let alarmId = UUID(uuidString: id) {
                                try await AlarmManager.shared.stop(id: alarmId)
                            }
                        }
                        self.scheduledAlarmIds.removeAll()
                        promise.resolve(true)
                    } catch {
                        promise.reject("CANCEL_ERROR", error.localizedDescription)
                    }
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
    }
}

// MARK: - Alarm Metadata

#if canImport(AlarmKit)
@available(iOS 26.0, *)
public struct NedaaAlarmMetadata: AlarmMetadata {
    public init() {}
}
#endif

// MARK: - App Intent to Open App

#if canImport(AlarmKit)
@available(iOS 26.0, *)
public struct OpenNedaaAlarmIntent: LiveActivityIntent {
    public static var title: LocalizedStringResource = "Open Nedaa Alarm"
    public static var description = IntentDescription("Opens Nedaa app to handle the alarm")
    public static var openAppWhenRun: Bool = true

    @Parameter(title: "Alarm ID")
    public var alarmId: String

    @Parameter(title: "Alarm Type")
    public var alarmType: String

    public init() {
        self.alarmId = ""
        self.alarmType = ""
    }

    public init(alarmId: String, alarmType: String) {
        self.alarmId = alarmId
        self.alarmType = alarmType
    }

    public func perform() async throws -> some IntentResult {
        // Open the app with deep link
        if let url = URL(string: "dev.nedaa.app://alarm?alarmId=\(alarmId)&alarmType=\(alarmType)") {
            await MainActor.run {
                UIApplication.shared.open(url)
            }
        }
        return .result()
    }
}
#endif
