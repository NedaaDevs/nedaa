import SwiftUI
import WidgetKit
import ActivityKit

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

@available(iOS 16.2, *)
struct AlarmLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmActivityAttributes.self) { context in
            LockScreenView(context: context)
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
                    if context.state.state == "countdown" {
                        Text(context.attributes.triggerTime, style: .relative)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    } else {
                        Text("Alarm firing!")
                            .font(.caption)
                            .foregroundColor(.orange)
                    }
                }
            } compactLeading: {
                Image(systemName: iconForAlarmType(context.attributes.alarmType))
                    .foregroundColor(colorForAlarmType(context.attributes.alarmType))
            } compactTrailing: {
                Text(context.attributes.triggerTime, style: .timer)
                    .frame(width: 50)
                    .monospacedDigit()
            } minimal: {
                Image(systemName: iconForAlarmType(context.attributes.alarmType))
                    .foregroundColor(colorForAlarmType(context.attributes.alarmType))
            }
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

@available(iOS 16.2, *)
struct LockScreenView: View {
    let context: ActivityViewContext<AlarmActivityAttributes>

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: iconForAlarmType(context.attributes.alarmType))
                .font(.largeTitle)
                .foregroundColor(colorForAlarmType(context.attributes.alarmType))

            VStack(alignment: .leading, spacing: 4) {
                Text(context.attributes.title)
                    .font(.headline)
                    .foregroundColor(.white)

                if context.state.state == "countdown" {
                    Text(context.attributes.triggerTime, style: .relative)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                } else {
                    Text("Time to wake up!")
                        .font(.subheadline)
                        .foregroundColor(.orange)
                }
            }

            Spacer()

            Text(context.attributes.triggerTime, style: .time)
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundColor(.white)
        }
        .padding()
        .background(Color.black.opacity(0.8))
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
