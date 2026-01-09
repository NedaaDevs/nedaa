import SwiftUI
import WidgetKit
import ActivityKit
import AppIntents

struct AlarmActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var state: String  // "countdown", "firing"
        var remainingSeconds: Int?
    }

    var alarmId: String
    var alarmType: String
    var title: String
    var triggerTime: Date
}

// MARK: - App Intent to Open Alarm Screen

@available(iOS 16.0, *)
struct DismissAlarmIntent: AppIntent {
    static var title: LocalizedStringResource = "Dismiss Alarm"
    static var description = IntentDescription("Opens Nedaa to dismiss the alarm")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Alarm ID")
    var alarmId: String

    @Parameter(title: "Alarm Type")
    var alarmType: String

    init() {
        self.alarmId = ""
        self.alarmType = ""
    }

    init(alarmId: String, alarmType: String) {
        self.alarmId = alarmId
        self.alarmType = alarmType
    }

    func perform() async throws -> some IntentResult {
        // openAppWhenRun will open the app, deep link handled by URL scheme
        return .result()
    }
}

// MARK: - Live Activity Widget

@available(iOS 16.2, *)
struct AlarmLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmActivityAttributes.self) { context in
            // Lock Screen / Notification Center view
            LockScreenView(context: context)
                .widgetURL(URL(string: "dev.nedaa.app://alarm?alarmId=\(context.attributes.alarmId)&alarmType=\(context.attributes.alarmType)"))
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded view
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: iconForAlarmType(context.attributes.alarmType))
                        .font(.title2)
                        .foregroundColor(colorForAlarmType(context.attributes.alarmType))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.attributes.triggerTime, style: .time)
                        .font(.title2)
                        .foregroundColor(.white)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.title)
                        .font(.headline)
                        .foregroundColor(.white)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if context.state.state == "firing" {
                        // Dismiss button when firing
                        Link(destination: URL(string: "dev.nedaa.app://alarm?alarmId=\(context.attributes.alarmId)&alarmType=\(context.attributes.alarmType)")!) {
                            Text("Dismiss")
                                .font(.headline)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                                .background(Color.red)
                                .cornerRadius(20)
                        }
                    } else {
                        Text(context.attributes.triggerTime, style: .relative)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            } compactLeading: {
                Image(systemName: iconForAlarmType(context.attributes.alarmType))
                    .foregroundColor(context.state.state == "firing" ? .red : colorForAlarmType(context.attributes.alarmType))
            } compactTrailing: {
                if context.state.state == "firing" {
                    Image(systemName: "bell.fill")
                        .foregroundColor(.red)
                } else {
                    Text(context.attributes.triggerTime, style: .timer)
                        .frame(width: 50)
                        .monospacedDigit()
                }
            } minimal: {
                Image(systemName: context.state.state == "firing" ? "bell.fill" : iconForAlarmType(context.attributes.alarmType))
                    .foregroundColor(context.state.state == "firing" ? .red : colorForAlarmType(context.attributes.alarmType))
            }
            // Tap anywhere on Dynamic Island to open app
            .widgetURL(URL(string: "dev.nedaa.app://alarm?alarmId=\(context.attributes.alarmId)&alarmType=\(context.attributes.alarmType)"))
        }
    }

    private func iconForAlarmType(_ type: String) -> String {
        switch type {
        case "fajr": return "sun.horizon.fill"
        case "jummah": return "building.columns.fill"
        default: return "bell.fill"
        }
    }

    private func colorForAlarmType(_ type: String) -> Color {
        switch type {
        case "fajr": return .orange
        case "jummah": return .green
        default: return .blue
        }
    }
}

// MARK: - Lock Screen View

@available(iOS 16.2, *)
struct LockScreenView: View {
    let context: ActivityViewContext<AlarmActivityAttributes>

    var body: some View {
        VStack(spacing: 12) {
            // Header row
            HStack(spacing: 16) {
                Image(systemName: iconForAlarmType(context.attributes.alarmType))
                    .font(.largeTitle)
                    .foregroundColor(context.state.state == "firing" ? .red : colorForAlarmType(context.attributes.alarmType))

                VStack(alignment: .leading, spacing: 4) {
                    Text(context.attributes.title)
                        .font(.headline)
                        .foregroundColor(.primary)

                    if context.state.state == "firing" {
                        Text("Time to wake up!")
                            .font(.subheadline)
                            .foregroundColor(.orange)
                    } else {
                        Text(context.attributes.triggerTime, style: .relative)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                Text(context.attributes.triggerTime, style: .time)
                    .font(.title2)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
            }

            // Dismiss button when alarm is firing
            if context.state.state == "firing" {
                Link(destination: URL(string: "dev.nedaa.app://alarm?alarmId=\(context.attributes.alarmId)&alarmType=\(context.attributes.alarmType)")!) {
                    Text("Dismiss")
                        .font(.headline)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.red)
                        .cornerRadius(25)
                }
            }
        }
        .padding()
        .activityBackgroundTint(Color(UIColor.systemBackground).opacity(0.9))
    }

    private func iconForAlarmType(_ type: String) -> String {
        switch type {
        case "fajr": return "sun.horizon.fill"
        case "jummah": return "building.columns.fill"
        default: return "bell.fill"
        }
    }

    private func colorForAlarmType(_ type: String) -> Color {
        switch type {
        case "fajr": return .orange
        case "jummah": return .green
        default: return .blue
        }
    }
}
