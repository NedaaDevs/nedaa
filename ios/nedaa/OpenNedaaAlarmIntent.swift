import Foundation

#if canImport(AlarmKit)
import AppIntents
internal import ExpoAlarm

/// Runs when someone uses the stop button on an AlarmKit alarm.
///
/// This lives in the app target rather than the ExpoAlarm module because AppIntents metadata
/// extraction records an empty `mangledTypeName` for intents compiled into a pod's static
/// library, which leaves the system unable to resolve the intent at run time. The behaviour
/// stays in the module, which owns the alarm database and the bypass backup.
@available(iOS 26.1, *)
struct OpenNedaaAlarmIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Open Nedaa Alarm"
    static var description = IntentDescription("Opens Nedaa app to handle the alarm")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Alarm ID")
    var alarmId: String

    @Parameter(title: "Alarm Type")
    var alarmType: String

    @Parameter(title: "Title")
    var alarmTitle: String

    init() {
        self.alarmId = ""
        self.alarmType = ""
        self.alarmTitle = "Alarm"
    }

    init(alarmId: String, alarmType: String, title: String) {
        self.alarmId = alarmId
        self.alarmType = alarmType
        self.alarmTitle = title
    }

    func perform() async throws -> some IntentResult {
        await AlarmStopIntentHandler.run(
            alarmId: alarmId,
            alarmType: alarmType,
            alarmTitle: alarmTitle
        )
        return .result()
    }
}
#endif
