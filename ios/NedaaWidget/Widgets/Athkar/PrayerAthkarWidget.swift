//
//  PrayerAthkarWidget.swift
//  NedaaWidgetExtension
//
//  Created by FA on 22/11/2025.
//

import SwiftUI
import WidgetKit
import AppIntents

// MARK: - Widget Configuration Intent

@available(iOS 17.0, *)
struct PrayerAthkarConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "widget_prayer_athkar_settings"
    static var description = IntentDescription("widget_prayer_athkar_settings_desc")
    
    @Parameter(title: "widget_show_countdown", default: true)
    var showCountdown: Bool
    
    @Parameter(title: "widget_show_sunrise", default: false)
    var showSunrise: Bool
}

// MARK: - Timeline Entry

struct PrayerAthkarEntry: TimelineEntry {
    let date: Date
    let nextPrayer: PrayerData?
    let previousPrayer: PrayerData?
    let allPrayers: [PrayerData]
    let athkarSummary: AthkarSummary?
    let showCountdown: Bool
    let showSunrise: Bool

    static var preview: PrayerAthkarEntry {
        let now = Date()
        let calendar = Calendar.current

        let prayers = [
            PrayerData(name: "fajr", date: calendar.date(bySettingHour: 5, minute: 30, second: 0, of: now)!),
            PrayerData(name: "sunrise", date: calendar.date(bySettingHour: 6, minute: 45, second: 0, of: now)!),
            PrayerData(name: "dhuhr", date: calendar.date(bySettingHour: 12, minute: 15, second: 0, of: now)!),
            PrayerData(name: "asr", date: calendar.date(bySettingHour: 15, minute: 30, second: 0, of: now)!),
            PrayerData(name: "maghrib", date: calendar.date(bySettingHour: 18, minute: 0, second: 0, of: now)!),
            PrayerData(name: "isha", date: calendar.date(bySettingHour: 19, minute: 30, second: 0, of: now)!)
        ]

        return PrayerAthkarEntry(
            date: now,
            nextPrayer: prayers[3],
            previousPrayer: prayers[2],
            allPrayers: prayers,
            athkarSummary: AthkarSummary(
                morningCompleted: true,
                eveningCompleted: false,
                currentStreak: 7,
                longestStreak: 15,
                totalItems: 10,
                completedItems: 7
            ),
            showCountdown: true,
            showSunrise: false
        )
    }
}

// MARK: - Timeline Provider

@available(iOS 17.0, *)
struct PrayerAthkarProvider: AppIntentTimelineProvider {
    typealias Entry = PrayerAthkarEntry
    typealias Intent = PrayerAthkarConfigurationIntent
    
    private let prayerService = PrayerDataService()
    private let athkarService = AthkarDataService()
    
    func placeholder(in context: Context) -> PrayerAthkarEntry {
        PrayerAthkarEntry.preview
    }
    
    func snapshot(for configuration: PrayerAthkarConfigurationIntent, in context: Context) async -> PrayerAthkarEntry {
        return createEntry(for: Date(), configuration: configuration)
    }
    
    func timeline(for configuration: PrayerAthkarConfigurationIntent, in context: Context) async -> Timeline<PrayerAthkarEntry> {
        let currentDate = Date()
        let entry = createEntry(for: currentDate, configuration: configuration)
        
        // Calculate next update time based on prayer times
        let nextUpdateDate = calculateNextUpdateDate(
            currentDate: currentDate,
            nextPrayerDate: entry.nextPrayer?.date ?? currentDate.addingTimeInterval(3600),
            previousPrayerDate: entry.previousPrayer?.date ?? currentDate
        )
        
        return Timeline(entries: [entry], policy: .after(nextUpdateDate))
    }
    
    private func createEntry(for date: Date, configuration: PrayerAthkarConfigurationIntent) -> PrayerAthkarEntry {
        let showSunrise = configuration.showSunrise
        let showCountdown = configuration.showCountdown
        
        // Get prayer data - no conversion needed, already PrayerData
        let prayerTimes = prayerService.getTodaysPrayerTimes(showSunrise: showSunrise) ?? []
        let prayers = prayerTimes

        let previousPrayer = prayerService.getPreviousPrayer(showSunrise: showSunrise)
        let nextPrayer = prayerService.getNextPrayer(showSunrise: showSunrise)

        // Get athkar data
        let athkarSummary = athkarService.getAthkarSummary()

        return PrayerAthkarEntry(
            date: date,
            nextPrayer: nextPrayer,
            previousPrayer: previousPrayer,
            allPrayers: prayers,
            athkarSummary: athkarSummary,
            showCountdown: showCountdown,
            showSunrise: showSunrise
        )
    }
    
    private func calculateNextUpdateDate(currentDate: Date, nextPrayerDate: Date, previousPrayerDate: Date) -> Date {
        let timeIntervalToNextPrayer = nextPrayerDate.timeIntervalSince(currentDate)
        let timeIntervalSincePreviousPrayer = currentDate.timeIntervalSince(previousPrayerDate)
        
        if timeIntervalSincePreviousPrayer < 1800 {
            // If the previous prayer was less than 30 minutes ago, update 30 minutes after the previous prayer
            return previousPrayerDate.addingTimeInterval(1800)
        } else if timeIntervalToNextPrayer > 3600 {
            // If the next prayer is more than 1 hour away, update 60 minutes before the next prayer
            return nextPrayerDate.addingTimeInterval(-3600)
        } else {
            // Otherwise, update 30 minutes after the next prayer
            return nextPrayerDate.addingTimeInterval(1800)
        }
    }
}

// MARK: - PrayerData Extensions for Widget Display

extension PrayerData {
    var displayName: String {
        name.capitalized
    }
    
    var formattedTime: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "h:mm a"
        return formatter.string(from: date)
    }
    
    var countdown: String {
        let interval = date.timeIntervalSince(Date())
        
        if interval < 0 {
            return NSLocalizedString("passed", comment: "Prayer time has passed")
        }
        
        let hours = Int(interval) / 3600
        let minutes = (Int(interval) % 3600) / 60
        
        if hours > 0 {
            return String(format: NSLocalizedString("countdown_hours_minutes", comment: "in Xh Ym"), hours, minutes)
        } else {
            return String(format: NSLocalizedString("countdown_minutes", comment: "in Xm"), minutes)
        }
    }
}

// Helper extension for AthkarSummary
extension AthkarSummary {
    var progress: Double {
        guard totalItems > 0 else { return 0 }
        return Double(completedItems) / Double(totalItems)
    }
    
    
}

// MARK: - Widget Views

struct PrayerAthkarWidgetMediumView: View {
    let entry: PrayerAthkarEntry
    @Environment(\.colorScheme) var colorScheme
    
    var body: some View {
        HStack(spacing: 12) {
            // Left side - Next Prayer
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 4) {
                    Image(systemName: "bell.fill")
                        .font(.system(size: 12))
                        .foregroundColor(NedaaColors.primary(for: colorScheme))

                    Text(LocalizedStringKey("next_prayer"))
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                }
                
                if let nextPrayer = entry.nextPrayer {
                    Text(LocalizedStringKey(nextPrayer.name))
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(NedaaColors.text(for: colorScheme))
                    
                    HStack(spacing: 4) {
                        Image(systemName: "clock.fill")
                            .font(.system(size: 11))
                            .foregroundColor(NedaaColors.primary(for: colorScheme))
                        
                        Text(nextPrayer.formattedTime)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(NedaaColors.primary(for: colorScheme))
                    }
                    
                    if entry.showCountdown {
                        HStack(spacing: 4) {
                            Image(systemName: "hourglass")
                                .font(.system(size: 9))
                                .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                            
                            Text(nextPrayer.countdown)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                        }
                    }
                } else {
                    Text(LocalizedStringKey("no_data"))
                        .font(.caption)
                        .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            
            Divider()
                .frame(height: 80)
            
            // Right side - Athkar Completion
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 4) {
                    Image(systemName: "book.closed.fill")
                        .font(.system(size: 12))
                        .foregroundColor(NedaaColors.success)

                    Text(LocalizedStringKey("athkar"))
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                }

                if let athkar = entry.athkarSummary {
                    VStack(spacing: 8) {
                        // Morning completion
                        AthkarCompletionRow(
                            isCompleted: athkar.morningCompleted,
                            icon: "sunrise.fill",
                            label: "morning",
                            colorScheme: colorScheme
                        )
                        
                        // Evening completion
                        AthkarCompletionRow(
                            isCompleted: athkar.eveningCompleted,
                            icon: "moon.stars.fill",
                            label: "evening",
                            colorScheme: colorScheme
                        )
                        
                        // Streak indicator
                        if athkar.currentStreak > 0 {
                            HStack(spacing: 4) {
                                Image(systemName: "flame.fill")
                                    .font(.system(size: 10))
                                    .foregroundColor(.orange)
                                
                                Text("\(athkar.currentStreak)")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(NedaaColors.text(for: colorScheme))
                                
                                Text(LocalizedStringKey("day_streak"))
                                    .font(.system(size: 9, weight: .medium))
                                    .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                } else {
                    Text(LocalizedStringKey("no_data"))
                        .font(.caption)
                        .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
    }
}

// Athkar Completion Row for Medium Widget
struct AthkarCompletionRow: View {
    let isCompleted: Bool
    let icon: String
    let label: String
    let colorScheme: ColorScheme
    
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: isCompleted ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 14))
                .foregroundColor(isCompleted ? NedaaColors.success : NedaaColors.textSecondary(for: colorScheme).opacity(0.3))
            
            Image(systemName: icon)
                .font(.system(size: 11))
                .foregroundColor(isCompleted ? NedaaColors.text(for: colorScheme) : NedaaColors.textSecondary(for: colorScheme))
            
            Text(LocalizedStringKey(label))
                .font(.system(size: 12, weight: isCompleted ? .semibold : .regular))
                .foregroundColor(isCompleted ? NedaaColors.text(for: colorScheme) : NedaaColors.textSecondary(for: colorScheme))
            
            Spacer()
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(isCompleted ? NedaaColors.success.opacity(0.12) : NedaaColors.textSecondary(for: colorScheme).opacity(0.05))
        )
    }
}

struct PrayerAthkarWidgetLargeView: View {
    let entry: PrayerAthkarEntry
    @Environment(\.colorScheme) var colorScheme
    
    var body: some View {
        VStack(spacing: 12) {
            // Header with next prayer countdown
            VStack(spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "bell.fill")
                        .font(.system(size: 16))
                        .foregroundColor(NedaaColors.primary(for: colorScheme))

                    Text(LocalizedStringKey("next_prayer"))
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                    
                    Spacer()
                    
                    if entry.showCountdown, let nextPrayer = entry.nextPrayer {
                        HStack(spacing: 4) {
                            Image(systemName: "hourglass")
                                .font(.system(size: 11))
                                .foregroundColor(NedaaColors.primary(for: colorScheme))
                            
                            Text(nextPrayer.countdown)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(NedaaColors.primary(for: colorScheme))
                        }
                    }
                }
                
                if let nextPrayer = entry.nextPrayer {
                    HStack(alignment: .firstTextBaseline) {
                        Text(LocalizedStringKey(nextPrayer.name))
                            .font(.system(size: 26, weight: .bold))
                            .foregroundColor(NedaaColors.text(for: colorScheme))
                        
                        Spacer()
                        
                        HStack(spacing: 4) {
                            Image(systemName: "clock.fill")
                                .font(.system(size: 14))
                                .foregroundColor(NedaaColors.primary(for: colorScheme))
                            
                            Text(nextPrayer.formattedTime)
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundColor(NedaaColors.primary(for: colorScheme))
                        }
                    }
                }
            }
            
            Divider()
            
            // All prayers list
            VStack(spacing: 4) {
                ForEach(entry.allPrayers, id: \.id) { prayer in
                    PrayerTimeRow(
                        prayer: prayer,
                        isNext: prayer.isSame(as: entry.nextPrayer),
                        colorScheme: colorScheme
                    )
                }
            }
            
            Divider()
            
            // Athkar progress section with linear progress
            if let athkar = entry.athkarSummary {
                VStack(alignment: .leading, spacing: 10) {
                    // Header
                    HStack(spacing: 4) {
                        Image(systemName: "book.closed.fill")
                            .font(.system(size: 13))
                            .foregroundColor(NedaaColors.success)

                        Text(LocalizedStringKey("todays_athkar"))
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(NedaaColors.text(for: colorScheme))
                        
                        Spacer()
                        
                        // Streak indicator
                        if athkar.currentStreak > 0 {
                            HStack(spacing: 4) {
                                Image(systemName: "flame.fill")
                                    .font(.system(size: 11))
                                    .foregroundColor(.orange)
                                
                                Text("\(athkar.currentStreak)")
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(NedaaColors.text(for: colorScheme))
                                
                                Text(LocalizedStringKey("days"))
                                    .font(.system(size: 10))
                                    .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                            }
                        }
                    }
                    
                    // Linear Progress Bar
                    VStack(alignment: .leading, spacing: 6) {
                        // Progress bar
                        GeometryReader { geometry in
                            ZStack(alignment: .leading) {
                                // Background
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(NedaaColors.textSecondary(for: colorScheme).opacity(0.15))
                                    .frame(height: 12)
                                
                                // Progress
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(
                                        LinearGradient(
                                            colors: [NedaaColors.success, NedaaColors.success.opacity(0.8)],
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        )
                                    )
                                    .frame(width: geometry.size.width * athkar.progress, height: 12)
                                    .animation(.spring(response: 0.6, dampingFraction: 0.8), value: athkar.progress)
                            }
                        }
                        .frame(height: 12)
                        
                        // Progress percentage only
                        Text("\(athkar.progressPercentage)% \(Text(LocalizedStringKey("complete")))")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                    }
                    
                    // Morning/Evening completion badges
                    HStack(spacing: 10) {
                        AthkarCompletionBadge(
                            isCompleted: athkar.morningCompleted,
                            icon: "sunrise.fill",
                            label: "morning",
                            colorScheme: colorScheme
                        )
                        
                        AthkarCompletionBadge(
                            isCompleted: athkar.eveningCompleted,
                            icon: "moon.stars.fill",
                            label: "evening",
                            colorScheme: colorScheme
                        )
                    }
                }
            }
        }
        .padding(14)
    }
}

// Athkar Completion Badge for Large Widget
struct AthkarCompletionBadge: View {
    let isCompleted: Bool
    let icon: String
    let label: String
    let colorScheme: ColorScheme
    
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: isCompleted ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 13))
                .foregroundColor(isCompleted ? NedaaColors.success : NedaaColors.textSecondary(for: colorScheme).opacity(0.3))
            
            Image(systemName: icon)
                .font(.system(size: 11))
                .foregroundColor(isCompleted ? NedaaColors.text(for: colorScheme) : NedaaColors.textSecondary(for: colorScheme))
            
            Text(LocalizedStringKey(label))
                .font(.system(size: 12, weight: isCompleted ? .semibold : .regular))
                .foregroundColor(isCompleted ? NedaaColors.text(for: colorScheme) : NedaaColors.textSecondary(for: colorScheme))
            
            Spacer()
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(isCompleted ? NedaaColors.success.opacity(0.12) : NedaaColors.textSecondary(for: colorScheme).opacity(0.05))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .strokeBorder(
                    isCompleted ? NedaaColors.success.opacity(0.3) : Color.clear,
                    lineWidth: 1
                )
        )
    }
}

// MARK: - Helper Views

struct PrayerTimeRow: View {
    let prayer: PrayerData
    let isNext: Bool
    let colorScheme: ColorScheme
    
    var body: some View {
        HStack {
            Text(LocalizedStringKey(prayer.name))
                .font(.system(size: 13, weight: isNext ? .semibold : .regular))
                .foregroundColor(isNext ? NedaaColors.primary(for: colorScheme) : (prayer.isPast ? NedaaColors.textSecondary(for: colorScheme) : NedaaColors.text(for: colorScheme)))
            
            Spacer()
            
            Text(prayer.formattedTime)
                .font(.system(size: 13, weight: isNext ? .semibold : .regular))
                .foregroundColor(isNext ? NedaaColors.primary(for: colorScheme) : (prayer.isPast ? NedaaColors.textSecondary(for: colorScheme) : NedaaColors.text(for: colorScheme)))
            
            if isNext {
                Image(systemName: "bell.fill")
                    .font(.system(size: 10))
                    .foregroundColor(NedaaColors.primary(for: colorScheme))
            }
        }
        .padding(.vertical, 2)
    }
}

// Background View for Prayer Athkar Widget
struct PrayerAthkarWidgetBackgroundView: View {
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

// MARK: - Widget Configuration

@available(iOS 17.0, *)
struct PrayerAthkarWidget: Widget {
    let kind: String = "PrayerAthkarWidget"
    
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: PrayerAthkarConfigurationIntent.self, provider: PrayerAthkarProvider()) { entry in
            if #available(iOS 17.0, *) {
                PrayerAthkarWidgetEntryView(entry: entry)
                    .containerBackground(for: .widget) {
                        PrayerAthkarWidgetBackgroundView()
                    }
            } else {
                PrayerAthkarWidgetEntryView(entry: entry)
                    .background(PrayerAthkarWidgetBackgroundView())
            }
        }
        .configurationDisplayName(NSLocalizedString("prayer_athkar_widget_title", comment: "Prayer & Athkar"))
        .description(NSLocalizedString("prayer_athkar_widget_desc", comment: "View next prayer time and daily Athkar progress together"))
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct PrayerAthkarWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: PrayerAthkarEntry
    
    var body: some View {
        switch family {
        case .systemMedium:
            PrayerAthkarWidgetMediumView(entry: entry)
        case .systemLarge:
            PrayerAthkarWidgetLargeView(entry: entry)
        default:
            PrayerAthkarWidgetMediumView(entry: entry)
        }
    }
}

// MARK: - Previews

@available(iOS 17.0, *)
#Preview(as: .systemMedium) {
    PrayerAthkarWidget()
} timeline: {
    PrayerAthkarEntry.preview
    PrayerAthkarEntry(
        date: Date(),
        nextPrayer: PrayerData(
            name: "maghrib",
            date: Calendar.current.date(bySettingHour: 18, minute: 0, second: 0, of: Date())!
        ),
        previousPrayer: PrayerData(
            name: "asr",
            date: Calendar.current.date(bySettingHour: 15, minute: 30, second: 0, of: Date())!
        ),
        allPrayers: [],
        athkarSummary: AthkarSummary(
            morningCompleted: true,
            eveningCompleted: false,
            currentStreak: 5,
            longestStreak: 12,
            totalItems: 10,
            completedItems: 2
        ),
        showCountdown: false,
        showSunrise: true
    )
}

@available(iOS 17.0, *)
#Preview(as: .systemLarge) {
    PrayerAthkarWidget()
} timeline: {
    PrayerAthkarEntry.preview
}
