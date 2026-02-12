import SwiftUI
import WidgetKit

// MARK: - Timeline Entry

struct AthkarProgressEntry: TimelineEntry {
    let date: Date
    let summary: AthkarSummary?

    static var preview: AthkarProgressEntry {
        AthkarProgressEntry(
            date: Date(),
            summary: AthkarSummary(
                morningCompleted: true,
                eveningCompleted: false,
                currentStreak: 5,
                longestStreak: 12,
                totalItems: 10,
                completedItems: 7
            )
        )
    }
}

// MARK: - Timeline Provider

struct AthkarProgressProvider: TimelineProvider {
    private let athkarService = AthkarDataService()
    
    func placeholder(in context: Context) -> AthkarProgressEntry {
        AthkarProgressEntry.preview
    }
    
    func getSnapshot(in context: Context, completion: @escaping (AthkarProgressEntry) -> Void) {
        let entry = createEntry(for: Date())
        completion(entry)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<AthkarProgressEntry>) -> Void) {
        let currentDate = Date()
        let entry = createEntry(for: currentDate)
        
        // Update at midnight to refresh for new day
        let calendar = Calendar.current
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: currentDate))!
        
        let timeline = Timeline(entries: [entry], policy: .after(tomorrow))
        completion(timeline)
    }
    
    private func createEntry(for date: Date) -> AthkarProgressEntry {
        let summary = athkarService.getAthkarSummary()
        return AthkarProgressEntry(date: date, summary: summary)
    }
}

// MARK: - Widget Views

// Background View for Athkar Widgets
struct AthkarWidgetBackgroundView: View {
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        LinearGradient(
            gradient: Gradient(colors: [
                NedaaColors.primary(for: colorScheme).opacity(0.15),
                NedaaColors.primary(for: colorScheme).opacity(0.05),
            ]),
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

struct AthkarProgressWidgetSmallView: View {
    let entry: AthkarProgressEntry
    @Environment(\.colorScheme) var colorScheme
    
    var body: some View {
        if let summary = entry.summary {
            let progress = summary.totalItems > 0 ? Double(summary.completedItems) / Double(summary.totalItems) : 0
            let percentage = Int(progress * 100)
            
            VStack(spacing: 8) {
                // Title
                Text(LocalizedStringKey("today_progress"))
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                
                // Circular progress with percentage
                ZStack {
                    // Background circle
                    Circle()
                        .stroke(NedaaColors.textSecondary(for: colorScheme).opacity(0.2), lineWidth: 8)
                    
                    // Progress circle
                    Circle()
                        .trim(from: 0, to: progress)
                        .stroke(
                            LinearGradient(
                                colors: [NedaaColors.primary(for: colorScheme), NedaaColors.primary(for: colorScheme).opacity(0.6)],
                                startPoint: .top,
                                endPoint: .bottom
                            ),
                            style: StrokeStyle(lineWidth: 8, lineCap: .round)
                        )
                        .rotationEffect(.degrees(-90))
                        .animation(.easeInOut, value: progress)
                    
                    // Percentage in center
                    Text("\(percentage)%")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundColor(NedaaColors.primary(for: colorScheme))
                        .numericContentTransition()
                        .accentableWidget()
                }
                .frame(width: 85, height: 85)
                
                // Morning & Evening indicators
                HStack(spacing: 12) {
                    VStack(spacing: 3) {
                        ZStack {
                            Circle()
                                .stroke(summary.morningCompleted ? NedaaColors.success : NedaaColors.textSecondary(for: colorScheme).opacity(0.3), lineWidth: 2)
                                .frame(width: 18, height: 18)
                            
                            if summary.morningCompleted {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundColor(NedaaColors.success)
                            }
                        }
                        
                        Text(LocalizedStringKey("morning"))
                            .font(.system(size: 8, weight: .medium))
                            .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                    }
                    
                    VStack(spacing: 3) {
                        ZStack {
                            Circle()
                                .stroke(summary.eveningCompleted ? NedaaColors.success : NedaaColors.textSecondary(for: colorScheme).opacity(0.3), lineWidth: 2)
                                .frame(width: 18, height: 18)
                            
                            if summary.eveningCompleted {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundColor(NedaaColors.success)
                            }
                        }
                        
                        Text(LocalizedStringKey("evening"))
                            .font(.system(size: 8, weight: .medium))
                            .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                    }
                }
            }
            .padding(12)
            .accessibilityElement(children: .combine)
        } else {
            VStack {
                Image(systemName: "book.closed")
                    .font(.system(size: 30))
                    .foregroundColor(NedaaColors.textSecondary(for: colorScheme))

                Text(LocalizedStringKey("no_data"))
                    .font(.caption)
                    .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
            }
        }
    }
}

struct AthkarProgressWidgetMediumView: View {
    let entry: AthkarProgressEntry
    @Environment(\.colorScheme) var colorScheme
    
    var body: some View {
        if let summary = entry.summary {
            let progress = summary.totalItems > 0 ? Double(summary.completedItems) / Double(summary.totalItems) : 0
            let percentage = Int(progress * 100)
            
            VStack(spacing: 12) {
                // Top row: Progress percentage with bar and streaks
                HStack(alignment: .top, spacing: 12) {
                    // Left: Progress
                    VStack(alignment: .leading, spacing: 6) {
                        Text(LocalizedStringKey("progress"))
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                        
                        HStack(alignment: .bottom, spacing: 8) {
                            Text("\(percentage)%")
                                .font(.system(size: 32, weight: .bold))
                                .foregroundColor(NedaaColors.primary(for: colorScheme))
                                .numericContentTransition()
                                .accentableWidget()
                            
                            // Progress bar
                            VStack(spacing: 4) {
                                Spacer()
                                GeometryReader { geometry in
                                    ZStack(alignment: .leading) {
                                        // Background
                                        RoundedRectangle(cornerRadius: 4)
                                            .fill(NedaaColors.textSecondary(for: colorScheme).opacity(0.2))
                                        
                                        // Progress
                                        RoundedRectangle(cornerRadius: 4)
                                            .fill(
                                                LinearGradient(
                                                    colors: [NedaaColors.primary(for: colorScheme), NedaaColors.primary(for: colorScheme).opacity(0.7)],
                                                    startPoint: .leading,
                                                    endPoint: .trailing
                                                )
                                            )
                                            .frame(width: geometry.size.width * progress)
                                    }
                                }
                                .frame(height: 8)
                            }
                            .frame(height: 32)
                        }
                    }
                    
                    Spacer()
                    
                    // Right: Streaks
                    HStack(spacing: 12) {
                        // Current Streak
                        VStack(spacing: 2) {
                            Image(systemName: "flame.fill")
                                .font(.system(size: 16))
                                .foregroundColor(.orange)
                            
                            Text("\(summary.currentStreak)")
                                .font(.system(size: 18, weight: .bold))
                                .foregroundColor(NedaaColors.text(for: colorScheme))
                            
                            Text(LocalizedStringKey("current"))
                                .font(.system(size: 9, weight: .medium))
                                .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                        }
                        
                        // Longest Streak
                        VStack(spacing: 2) {
                            Image(systemName: "trophy.fill")
                                .font(.system(size: 16))
                                .foregroundColor(NedaaColors.warning)
                            
                            Text("\(summary.longestStreak)")
                                .font(.system(size: 18, weight: .bold))
                                .foregroundColor(NedaaColors.text(for: colorScheme))
                            
                            Text(LocalizedStringKey("best"))
                                .font(.system(size: 9, weight: .medium))
                                .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                        }
                    }
                }
                
                Divider()
                
                // Bottom row: Morning & Evening (split evenly)
                HStack(spacing: 0) {
                    // Morning - takes half the space
                    HStack(spacing: 8) {
                        ZStack {
                            Circle()
                                .stroke(summary.morningCompleted ? NedaaColors.success : NedaaColors.textSecondary(for: colorScheme).opacity(0.3), lineWidth: 2.5)
                                .frame(width: 28, height: 28)
                            
                            if summary.morningCompleted {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(NedaaColors.success)
                            }
                        }
                        
                        Text(LocalizedStringKey("morning"))
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(NedaaColors.text(for: colorScheme))
                        
                        Spacer()
                    }
                    .frame(maxWidth: .infinity)
                    
                    // Evening - takes half the space
                    HStack(spacing: 8) {
                        ZStack {
                            Circle()
                                .stroke(summary.eveningCompleted ? NedaaColors.success : NedaaColors.textSecondary(for: colorScheme).opacity(0.3), lineWidth: 2.5)
                                .frame(width: 28, height: 28)
                            
                            if summary.eveningCompleted {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundColor(NedaaColors.success)
                            }
                        }
                        
                        Text(LocalizedStringKey("evening"))
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(NedaaColors.text(for: colorScheme))
                        
                        Spacer()
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(16)
            .accessibilityElement(children: .combine)
        } else {
            HStack {
                Image(systemName: "book.closed")
                    .font(.system(size: 40))
                    .foregroundColor(NedaaColors.textSecondary(for: colorScheme))

                Text(LocalizedStringKey("no_athkar_data"))
                    .font(.body)
                    .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
            }
        }
    }
}

// MARK: - Large Widget (Commented Out)
/*
struct AthkarProgressWidgetLargeView: View {
    let entry: AthkarProgressEntry
    @Environment(\.colorScheme) var colorScheme
    
    var body: some View {
        ZStack {
            // Background
            NedaaColors.surface(for: colorScheme)
            
            if let progress = entry.progress {
                VStack(spacing: 16) {
                    // Header
                    HStack(spacing: 8) {
                        Image(systemName: "book.closed.fill")
                            .font(.system(size: 20))
                            .foregroundColor(NedaaColors.success)

                        Text(NSLocalizedString("Today's Athkar Progress", comment: "Today's athkar progress title"))
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(NedaaColors.text(for: colorScheme))
                        
                        Spacer()
                    }
                    
                    // Main circular progress
                    ZStack {
                        Circle()
                            .stroke(NedaaColors.textSecondary(for: colorScheme).opacity(0.2), lineWidth: 14)
                        
                        Circle()
                            .trim(from: 0, to: progress.progress)
                            .stroke(
                                LinearGradient(
                                    colors: [NedaaColors.success, NedaaColors.success.opacity(0.6)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                style: StrokeStyle(lineWidth: 14, lineCap: .round)
                            )
                            .rotationEffect(.degrees(-90))
                            .animation(.easeInOut, value: progress.progress)
                        
                        VStack(spacing: 4) {
                            Text("\(progress.progressPercentage)%")
                                .font(.system(size: 48, weight: .bold))
                                .foregroundColor(NedaaColors.text(for: colorScheme))

                            Text("complete")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                        }
                    }
                    .frame(width: 140, height: 140)
                    
                    // Details section
                    VStack(spacing: 12) {
                        HStack {
                            DetailCard(
                                icon: "checkmark.circle.fill",
                                title: NSLocalizedString("Items", comment: "Athkar items label"),
                                value: "\(progress.completedItems)/\(progress.totalItems)",
                                color: NedaaColors.success,
                                colorScheme: colorScheme
                            )

                            DetailCard(
                                icon: "chart.bar.fill",
                                title: NSLocalizedString("Progress", comment: "Athkar progress label"),
                                value: "\(progress.progressPercentage)%",
                                color: NedaaColors.primary(for: colorScheme),
                                colorScheme: colorScheme
                            )
                        }
                        
                        // Progress bar
                        VStack(alignment: .leading, spacing: 6) {
                            Text(NSLocalizedString("Overall Progress", comment: "Overall athkar progress label"))
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                            
                            GeometryReader { geometry in
                                ZStack(alignment: .leading) {
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(NedaaColors.textSecondary(for: colorScheme).opacity(0.2))
                                    
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(
                                            LinearGradient(
                                                colors: [NedaaColors.success, NedaaColors.success.opacity(0.7)],
                                                startPoint: .leading,
                                                endPoint: .trailing
                                            )
                                        )
                                        .frame(width: geometry.size.width * progress.progress)
                                }
                            }
                            .frame(height: 8)
                        }
                    }
                    
                    Spacer()
                }
                .padding(16)
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "book.closed")
                        .font(.system(size: 50))
                        .foregroundColor(NedaaColors.textSecondary(for: colorScheme))

                    Text(NSLocalizedString("No Athkar data available", comment: "No athkar data message"))
                        .font(.body)
                        .foregroundColor(NedaaColors.textSecondary(for: colorScheme))

                    Text(NSLocalizedString("Start tracking your daily Athkar in the app", comment: "Start athkar tracking message"))
                        .font(.caption)
                        .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                        .multilineTextAlignment(.center)
                }
                .padding()
            }
        }
    }
}
*/

// MARK: - Widget Configuration

struct AthkarProgressWidget: Widget {
    let kind: String = "AthkarProgressWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AthkarProgressProvider()) { entry in
            if #available(iOS 17.0, *) {
                AthkarProgressWidgetEntryView(entry: entry)
                    .containerBackground(for: .widget) {
                        AthkarWidgetBackgroundView()
                    }
            } else {
                AthkarProgressWidgetEntryView(entry: entry)
                    .background(AthkarWidgetBackgroundView())
            }
        }
        .configurationDisplayName(NSLocalizedString("athkar_progress_widget_title", comment: "Athkar Progress"))
        .description(NSLocalizedString("athkar_progress_widget_desc", comment: "Track your daily Athkar completion and progress"))
        .supportedFamilies([.systemSmall, .systemMedium])  // Large widget commented out
    }
}

struct AthkarProgressWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: AthkarProgressEntry

    var body: some View {
        Group {
            switch family {
            case .systemSmall:
                AthkarProgressWidgetSmallView(entry: entry)
            case .systemMedium:
                AthkarProgressWidgetMediumView(entry: entry)
            default:
                AthkarProgressWidgetSmallView(entry: entry)
            }
        }
        .widgetURL(URL(string: "myapp:///athkar"))
    }
}

// MARK: - Previews

@available(iOS 17.0, *)
#Preview(as: .systemSmall) {
    AthkarProgressWidget()
} timeline: {
    AthkarProgressEntry.preview
    AthkarProgressEntry(
        date: Date(),
        summary: AthkarSummary(
            morningCompleted: false,
            eveningCompleted: true,
            currentStreak: 3,
            longestStreak: 12,
            totalItems: 10,
            completedItems: 3
        )
    )
}

@available(iOS 17.0, *)
#Preview(as: .systemMedium) {
    AthkarProgressWidget()
} timeline: {
    AthkarProgressEntry.preview
}

/* Large widget preview commented out
@available(iOS 17.0, *)
#Preview(as: .systemLarge) {
    AthkarProgressWidget()
} timeline: {
    AthkarProgressEntry.preview
}
*/
