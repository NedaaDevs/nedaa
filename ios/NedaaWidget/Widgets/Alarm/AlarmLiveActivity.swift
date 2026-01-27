import SwiftUI
import WidgetKit
import ActivityKit
import AppIntents


// MARK: - Shared Helpers

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
        return .result()
    }
}

// MARK: - Live Activity Widget

@available(iOS 16.2, *)
struct AlarmLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmActivityAttributes.self) { context in
            LockScreenView(context: context)
                .widgetURL(URL(string: "dev.nedaa.app://alarm?alarmId=\(context.attributes.alarmId)&alarmType=\(context.attributes.alarmType)"))
        } dynamicIsland: { context in
            DynamicIsland {
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
                    if context.state.state == "firing" || context.isStale {
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
                Image(systemName: context.attributes.title.contains("Snoozed") ? "zzz" : iconForAlarmType(context.attributes.alarmType))
                    .foregroundColor(context.state.state == "firing" ? .red : (context.attributes.title.contains("Snoozed") ? .purple : colorForAlarmType(context.attributes.alarmType)))
            } compactTrailing: {
                if context.state.state == "firing" || context.isStale {
                    Image(systemName: "bell.fill")
                        .foregroundColor(.red)
                } else {
                    Text(context.attributes.triggerTime, style: .timer)
                        .frame(width: 50)
                        .monospacedDigit()
                        .foregroundColor(context.attributes.title.contains("Snoozed") ? .purple : .white)
                }
            } minimal: {
                Image(systemName: (context.state.state == "firing" || context.isStale) ? "bell.fill" : (context.attributes.title.contains("Snoozed") ? "zzz" : iconForAlarmType(context.attributes.alarmType)))
                    .foregroundColor((context.state.state == "firing" || context.isStale) ? .red : (context.attributes.title.contains("Snoozed") ? .purple : colorForAlarmType(context.attributes.alarmType)))
            }
            .widgetURL(URL(string: "dev.nedaa.app://alarm?alarmId=\(context.attributes.alarmId)&alarmType=\(context.attributes.alarmType)"))
        }
    }
}

// MARK: - Lock Screen View

@available(iOS 16.2, *)
struct LockScreenView: View {
    let context: ActivityViewContext<AlarmActivityAttributes>

    private var isFiringOrStale: Bool {
        context.state.state == "firing" || context.isStale
    }

    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 16) {
                Image(systemName: context.attributes.title.contains("Snoozed") ? "zzz" : iconForAlarmType(context.attributes.alarmType))
                    .font(.largeTitle)
                    .foregroundColor(isFiringOrStale ? .red : (context.attributes.title.contains("Snoozed") ? .purple : colorForAlarmType(context.attributes.alarmType)))

                VStack(alignment: .leading, spacing: 4) {
                    Text(context.attributes.title)
                        .font(.headline)
                        .foregroundColor(.primary)

                    if isFiringOrStale {
                        Text("Time to wake up!")
                            .font(.subheadline)
                            .foregroundColor(.orange)
                    } else if context.attributes.title.contains("Snoozed") {
                        Text(context.attributes.triggerTime, style: .relative)
                            .font(.subheadline)
                            .foregroundColor(.purple)
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

            if isFiringOrStale {
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
        .activityBackgroundTint(Color(.systemBackground).opacity(0.9))
    }
}
