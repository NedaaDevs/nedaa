import SwiftUI
import WidgetKit

#if canImport(AlarmKit)
import AlarmKit

// MARK: - AlarmKit Widget for Live Activities
// This widget displays AlarmKit alarms in the Dynamic Island and Lock Screen
// The system automatically manages the countdown, alert, and paused states

@available(iOS 26.0, *)
struct AlarmKitCountdownWidget: Widget {
    var body: some WidgetConfiguration {
        // Use ActivityConfiguration with AlarmAttributes
        ActivityConfiguration(for: AlarmAttributes<NedaaAlarmMetadata>.self) { context in
            // Lock Screen / Banner presentation
            AlarmKitLockScreenView(context: context)
        } dynamicIsland: { context in
            // Dynamic Island presentations
            DynamicIsland {
                // Expanded view (when user long-presses Dynamic Island)
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "bell.fill")
                        .font(.title2)
                        .foregroundColor(.blue)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    // Display countdown timer or time
                    Text(context.attributes.presentation.alert.title)
                        .font(.title3)
                        .foregroundColor(.white)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.presentation.alert.title)
                        .font(.headline)
                        .foregroundColor(.white)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 4) {
                        Text("Alarm Active")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            } compactLeading: {
                // Compact leading (left side of Dynamic Island)
                Image(systemName: "bell.fill")
                    .foregroundColor(.blue)
            } compactTrailing: {
                // Compact trailing (right side of Dynamic Island)
                Image(systemName: "timer")
                    .foregroundColor(.blue)
            } minimal: {
                // Minimal (when multiple Live Activities are active)
                Image(systemName: "bell.fill")
                    .foregroundColor(.blue)
            }
        }
    }
}

// MARK: - Lock Screen View for AlarmKit

@available(iOS 26.0, *)
struct AlarmKitLockScreenView: View {
    let context: ActivityViewContext<AlarmAttributes<NedaaAlarmMetadata>>

    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 16) {
                // Icon
                Image(systemName: "bell.fill")
                    .font(.largeTitle)
                    .foregroundColor(.blue)

                // Title and status
                VStack(alignment: .leading, spacing: 4) {
                    Text(context.attributes.presentation.alert.title)
                        .font(.headline)
                        .foregroundColor(.primary)

                    Text("Alarm Active")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }
        }
        .padding()
        .activityBackgroundTint(Color(.systemBackground).opacity(0.9))
    }
}

// MARK: - Metadata for AlarmKit
// This must match NedaaAlarmMetadata in ExpoAlarmModule.swift

@available(iOS 26.0, *)
public struct NedaaAlarmMetadata: AlarmMetadata {
    public init() {}
}

#endif
