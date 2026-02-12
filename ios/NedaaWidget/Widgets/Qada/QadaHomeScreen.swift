import SwiftUI
import WidgetKit

// MARK: - Widget Definition
struct QadaHomeScreen: Widget {
    let kind: String = "QadaHomeScreen"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QadaHomeScreenProvider()) { entry in
            if #available(iOS 17.0, *) {
                QadaHomeScreenEntryView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                QadaHomeScreenEntryView(entry: entry)
                    .padding()
                    .background()
            }
        }
        .configurationDisplayName(NSLocalizedString("qadaTrackerWidgetTitle", comment: ""))
        .description(NSLocalizedString("qadaTrackerWidgetDesc", comment: ""))
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Entry View
struct QadaHomeScreenEntryView: View {
    var entry: QadaHomeScreenEntry
    @Environment(\.widgetFamily) var widgetFamily
    
    var body: some View {
        switch widgetFamily {
        case .systemSmall:
            SmallQadaView(entry: entry)
        case .systemMedium:
            MediumQadaView(entry: entry)
        case .systemLarge:
            LargeQadaView(entry: entry)
        default:
            SmallQadaView(entry: entry)
        }
    }
}

// MARK: - Timeline Entry
struct QadaHomeScreenEntry: TimelineEntry {
    let date: Date
    let totalRemaining: Int
    let totalCompleted: Int
    let todayCompleted: Int

    var totalFasts: Int {
        totalRemaining + totalCompleted
    }

    var completionPercentage: Int {
        guard totalFasts > 0 else { return 0 }
        return Int((Double(totalCompleted) / Double(totalFasts)) * 100)
    }

    var progress: Double {
        guard totalFasts > 0 else { return 0 }
        return Double(totalCompleted) / Double(totalFasts)
    }

    static var preview: QadaHomeScreenEntry {
        QadaHomeScreenEntry(
            date: Date(),
            totalRemaining: 7,
            totalCompleted: 2,
            todayCompleted: 1
        )
    }
}

// MARK: - Timeline Provider
struct QadaHomeScreenProvider: TimelineProvider {
    func placeholder(in context: Context) -> QadaHomeScreenEntry {
        QadaHomeScreenEntry.preview
    }
    
    func getSnapshot(in context: Context, completion: @escaping (QadaHomeScreenEntry) -> Void) {
        let entry = QadaHomeScreenEntry.preview
        completion(entry)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<QadaHomeScreenEntry>) -> Void) {
        let currentDate = Date()
        let entry = createEntry(for: currentDate)

        // Update widget every hour
        let nextUpdateDate = Calendar.current.date(byAdding: .hour, value: 1, to: currentDate)!

        let timeline = Timeline(entries: [entry], policy: .after(nextUpdateDate))
        completion(timeline)
    }

    private func createEntry(for date: Date) -> QadaHomeScreenEntry {
        let qadaService = QadaDataService()
        let summary = qadaService.getQadaSummary()

        return QadaHomeScreenEntry(
            date: date,
            totalRemaining: summary.totalMissed,
            totalCompleted: summary.totalCompleted,
            todayCompleted: summary.todayCompleted
        )
    }
}

// MARK: - Small Widget View
struct SmallQadaView: View {
    let entry: QadaHomeScreenEntry
    @Environment(\.colorScheme) var colorScheme
    
    var body: some View {
        VStack(spacing: 8) {
            // Header
            HStack {
                Image(systemName: "arrow.circlepath")
                    .foregroundStyle(NedaaColors.primary(for: colorScheme))
                Text(NSLocalizedString("qada", comment: ""))
                    .font(.caption)
                    .fontWeight(.semibold)
            }

            Spacer()

            // Total Count
            VStack(spacing: 4) {
                Text("\(entry.totalRemaining)")
                    .font(.system(size: 40, weight: .bold))
                    .foregroundStyle(NedaaColors.primary(for: colorScheme))

                Text(NSLocalizedString("remaining", comment: ""))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // Today's progress
            if entry.todayCompleted > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(NedaaColors.success)
                        .font(.caption2)

                    Text(String(format: NSLocalizedString("todayCompleted", comment: ""), entry.todayCompleted))
                        .font(.caption2)
                        .fontWeight(.semibold)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(NedaaColors.success.opacity(0.2))
                .clipShape(Capsule())
            }
        }
        .padding()
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Medium Widget View
struct MediumQadaView: View {
    let entry: QadaHomeScreenEntry
    @Environment(\.colorScheme) var colorScheme
    
    var body: some View {
        HStack(spacing: 16) {
            // Left side - Summary
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: "arrow.circlepath")
                        .foregroundStyle(NedaaColors.primary(for: colorScheme))
                    Text(NSLocalizedString("qadaTracker", comment: ""))
                        .font(.caption)
                        .fontWeight(.semibold)
                }
                
                Spacer()
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(entry.totalRemaining)")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(NedaaColors.primary(for: colorScheme))
                    
                    Text(NSLocalizedString("fastsRemaining", comment: ""))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text("\(entry.totalCompleted)")
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundStyle(NedaaColors.success)

                    Text(NSLocalizedString("completed", comment: ""))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                if entry.todayCompleted > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(NedaaColors.success)
                            .font(.caption)
                        
                        Text(String(format: NSLocalizedString("completedToday", comment: ""), entry.todayCompleted))
                            .font(.caption)
                            .fontWeight(.semibold)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            
            Divider()

            // Right side - Progress visualization
            VStack(alignment: .leading, spacing: 12) {
                Text(NSLocalizedString("progress", comment: ""))
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)

                // Circular progress or percentage
                VStack(spacing: 8) {
                    // Large percentage
                    Text("\(entry.completionPercentage)%")
                        .font(.system(size: 32, weight: .bold))
                        .foregroundStyle(NedaaColors.primary(for: colorScheme))

                    // Progress bar
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            Rectangle()
                                .fill(Color.secondary.opacity(0.2))

                            Rectangle()
                                .fill(NedaaColors.primary(for: colorScheme))
                                .frame(width: geometry.size.width * entry.progress)
                        }
                    }
                    .frame(height: 8)
                    .clipShape(Capsule())

                    // Label
                    Text(NSLocalizedString("complete", comment: ""))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Large Widget View
struct LargeQadaView: View {
    let entry: QadaHomeScreenEntry
    @Environment(\.colorScheme) var colorScheme
    
    var body: some View {
        VStack(spacing: 16) {
            // Header
            HStack {
                Image(systemName: "arrow.circlepath")
                    .font(.title2)
                    .foregroundStyle(NedaaColors.primary(for: colorScheme))
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(NSLocalizedString("qadaTracker", comment: ""))
                        .font(.headline)
                        .fontWeight(.bold)

                    Text(NSLocalizedString("missedFasts", comment: ""))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                
                Spacer()
                
                if entry.todayCompleted > 0 {
                    HStack(spacing: 4) {
                        Text("+\(entry.todayCompleted)")
                            .font(.caption)
                            .fontWeight(.bold)
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(NedaaColors.success)
                            .font(.caption)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(NedaaColors.success.opacity(0.2))
                    .clipShape(Capsule())
                }
            }
            
            // Summary Stats
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(entry.totalRemaining)")
                        .font(.system(size: 40, weight: .bold))
                        .foregroundStyle(NedaaColors.primary(for: colorScheme))
                    
                    Text(NSLocalizedString("remaining", comment: ""))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(NedaaColors.primary(for: colorScheme).opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 12))

                VStack(alignment: .leading, spacing: 4) {
                    Text("\(entry.totalCompleted)")
                        .font(.system(size: 40, weight: .bold))
                        .foregroundStyle(NedaaColors.success)

                    Text(NSLocalizedString("completed", comment: ""))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(NedaaColors.success.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            
            Divider()

            // Progress visualization
            VStack(spacing: 12) {
                // Progress bar
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(NSLocalizedString("progress", comment: ""))
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(.secondary)

                        Spacer()

                        Text("\(entry.completionPercentage)%")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(NedaaColors.primary(for: colorScheme))
                    }

                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            Rectangle()
                                .fill(Color.secondary.opacity(0.2))

                            Rectangle()
                                .fill(
                                    LinearGradient(
                                        colors: [
                                            NedaaColors.primary(for: colorScheme),
                                            NedaaColors.primary(for: colorScheme).opacity(0.7)
                                        ],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(width: geometry.size.width * entry.progress)
                        }
                    }
                    .frame(height: 12)
                    .clipShape(Capsule())
                }

                // Stats
                HStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(NSLocalizedString("totalFasts", comment: ""))
                            .font(.caption2)
                            .foregroundStyle(.secondary)

                        Text("\(entry.totalFasts)")
                            .font(.title3)
                            .fontWeight(.bold)
                    }

                    Spacer()

                    if entry.todayCompleted > 0 {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(NSLocalizedString("todayProgress", comment: ""))
                                .font(.caption2)
                                .foregroundStyle(.secondary)

                            HStack(spacing: 4) {
                                Text("+\(entry.todayCompleted)")
                                    .font(.title3)
                                    .fontWeight(.bold)
                                    .foregroundStyle(NedaaColors.success)

                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(NedaaColors.success)
                            }
                        }
                    }
                }
            }
            .padding()
            .background(Color.secondary.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 12))

            Spacer()
        }
        .padding()
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Supporting Views

// MARK: - Previews
#if swift(>=5.9)
@available(iOS 17.0, *)
#Preview("Small", as: .systemSmall) {
    QadaHomeScreen()
} timeline: {
    QadaHomeScreenEntry.preview
}

@available(iOS 17.0, *)
#Preview("Medium", as: .systemMedium) {
    QadaHomeScreen()
} timeline: {
    QadaHomeScreenEntry.preview
}

@available(iOS 17.0, *)
#Preview("Large", as: .systemLarge) {
    QadaHomeScreen()
} timeline: {
    QadaHomeScreenEntry.preview
}
#endif
