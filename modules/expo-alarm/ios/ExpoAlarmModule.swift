import ExpoModulesCore

#if canImport(AlarmKit)
import AlarmKit
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

        AsyncFunction("scheduleAlarm") { (id: String, triggerTimestamp: Double, title: String, alarmType: String, sound: String?, promise: Promise) in
            #if canImport(AlarmKit)
            if #available(iOS 26.0, *) {
                Task {
                    do {
                        let triggerDate = Date(timeIntervalSince1970: triggerTimestamp / 1000.0)

                        // Create schedule
                        let schedule = Alarm.Schedule.fixed(triggerDate)

                        // Create stop button
                        let stopButton = AlarmButton(
                            text: "Dismiss",
                            textColor: .white,
                            systemImageName: "stop.circle.fill"
                        )

                        // Create open app button
                        let openButton = AlarmButton(
                            text: "Open",
                            textColor: .white,
                            systemImageName: "arrow.right.circle.fill"
                        )

                        // Create alert presentation
                        let alertPresentation = AlarmPresentation.Alert(
                            title: title,
                            stopButton: stopButton,
                            secondaryButton: openButton,
                            secondaryButtonBehavior: .custom
                        )

                        // Create attributes
                        let attributes = AlarmAttributes<NedaaAlarmMetadata>(
                            presentation: AlarmPresentation(alert: alertPresentation),
                            tintColor: alarmType == "fajr" ? .orange : .green
                        )

                        // Configure sound
                        var alarmSound: AlertConfiguration.AlertSound? = nil
                        if let soundName = sound {
                            alarmSound = AlertConfiguration.AlertSound.named(soundName)
                        }

                        // Create configuration
                        let config = AlarmConfiguration(
                            schedule: schedule,
                            attributes: attributes,
                            sound: alarmSound
                        )

                        // Schedule the alarm
                        let alarmId = UUID(uuidString: id) ?? UUID()
                        try await AlarmManager.shared.schedule(id: alarmId, configuration: config)

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
                            try await AlarmManager.shared.cancel(id: alarmId)
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
                                try await AlarmManager.shared.cancel(id: alarmId)
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
