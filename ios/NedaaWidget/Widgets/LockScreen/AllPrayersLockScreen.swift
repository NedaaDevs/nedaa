import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Widget Configuration Intent

@available(iOS 17.0, *)
struct AllPrayersConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "widget_all_prayers_settings"
    static var description = IntentDescription("widget_all_prayers_settings_desc")
    
    @Parameter(title: "widget_show_timer", default: true)
    var showTimer: Bool
    
    @Parameter(title: "widget_show_sunrise", default: true)
    var showSunrise: Bool
}

// MARK: - Timeline Entry

struct AllPrayersEntry: TimelineEntry {
    let date: Date
    let allPrayers: [PrayerData]?
    let nextPrayer: PrayerData?
    let previousPrayer: PrayerData?
    let showTimer: Bool
    let showSunrise: Bool

    var relevance: TimelineEntryRelevance? {
        prayerTimelineRelevance(nextPrayerDate: nextPrayer?.date, previousPrayerDate: previousPrayer?.date, currentDate: date)
    }
}

// MARK: - Preview Data

let morningPrayers: [PrayerData] = [
    PrayerData(name: NSLocalizedString("fajr", comment: ""), date: Date()),
    PrayerData(name: NSLocalizedString("sunrise", comment: ""), date: Date()),
    PrayerData(name: NSLocalizedString("dhuhr", comment: ""), date: Date()),
]

let eveningPrayers: [PrayerData] = [
    PrayerData(name: NSLocalizedString("asr", comment: ""), date: Date()),
    PrayerData(name: NSLocalizedString("maghrib", comment: ""), date: Date()),
    PrayerData(name: NSLocalizedString("isha", comment: ""), date: Date()),
]

// MARK: - Timeline Provider

@available(iOS 17.0, *)
struct SplitPrayerProvider: AppIntentTimelineProvider {
    let isFirstHalf: Bool
    
    typealias Entry = AllPrayersEntry
    typealias Intent = AllPrayersConfigurationIntent
    
    private let prayerService = PrayerDataService()
    
    func placeholder(in context: Context) -> AllPrayersEntry {
        AllPrayersEntry(
            date: Date(),
            allPrayers: isFirstHalf ? morningPrayers : eveningPrayers,
            nextPrayer: PrayerData(name: "Fajr", date: Date()),
            previousPrayer: nil,
            showTimer: true,
            showSunrise: true
        )
    }
    
    func snapshot(for configuration: AllPrayersConfigurationIntent, in context: Context) async -> AllPrayersEntry {
        return placeholder(in: context)
    }
    
    func timeline(for configuration: AllPrayersConfigurationIntent, in context: Context) async -> Timeline<AllPrayersEntry> {
        let currentDate = Date()
        let showSunrise = configuration.showSunrise
        let showTimer = configuration.showTimer
        
        let nextPrayer = prayerService.getNextPrayer(showSunrise: showSunrise) ?? PrayerData(name: "DB ERROR", date: Date())
        let previousPrayer = prayerService.getPreviousPrayer(showSunrise: showSunrise) ?? PrayerData(name: "DB ERROR", date: Date())
        
        let todaysPrayers = prayerService.getTodaysPrayerTimes(showSunrise: showSunrise)
        
        // Check if we're after the last prayer of today (Isha)
        let isAfterLastPrayer = currentDate > todaysPrayers?.last?.date ?? Date()
        
        let displayPrayers: [PrayerData]?
        if isAfterLastPrayer {
            // After Isha: Show tomorrow's prayers
            let tomorrowsPrayers = prayerService.getTomorrowsPrayerTimes(showSunrise: showSunrise)
            displayPrayers = tomorrowsPrayers?.enumerated().filter { index, _ in
                isFirstHalf ? index < 3 : index >= 3
            }.map { $0.element }
        } else {
            // During the day: Show today's prayers
            displayPrayers = todaysPrayers?.enumerated().filter { index, _ in
                isFirstHalf ? index < 3 : index >= 3
            }.map { $0.element }
        }
        
        let entry = AllPrayersEntry(
            date: currentDate,
            allPrayers: displayPrayers,
            nextPrayer: nextPrayer,
            previousPrayer: previousPrayer,
            showTimer: showTimer,
            showSunrise: showSunrise
        )
        
        let nextUpdateDate = calculateNextUpdateDate(
            currentDate: currentDate,
            nextPrayerDate: nextPrayer.date,
            previousPrayerDate: previousPrayer.date
        )
        
        return Timeline(entries: [entry], policy: .after(nextUpdateDate))
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

@available(iOSApplicationExtension 17.0, *)
struct PrayerView: View {
    var entry: AllPrayersEntry
    @Environment(\.widgetFamily) var family

    func timeToNextPrayer(prayer: PrayerData) -> Int? {
        if prayer.name == entry.nextPrayer?.name {
            return Calendar.current.dateComponents(
                [.minute], from: entry.date, to: prayer.date
            ).minute
        }
        return nil
    }

    var body: some View {
        if let prayers = entry.allPrayers {
            VStack(alignment: .leading, spacing: 2) {
                ForEach(prayers, id: \.id) { prayer in
                    let isNext = prayer.name == entry.nextPrayer?.name
                    let minutesUntilPrayer = timeToNextPrayer(prayer: prayer)
                    let showCountdown = isNext && (minutesUntilPrayer ?? 0) <= 60 && entry.showTimer

                    HStack(spacing: 8) {
                        // Circle indicator
                        Circle()
                            .stroke(Color.white.opacity(0.6), lineWidth: 1)
                            .overlay(
                                Circle()
                                    .fill(isNext ? .white : .clear)
                                    .frame(width: 6, height: 6)
                            )
                            .frame(width: 8, height: 8)

                        // Prayer name
                        Text(NSLocalizedString(prayer.name, comment: ""))
                            .font(.system(size: 14, weight: .medium))
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        // Time/Timer
                        if showCountdown {
                            Text(prayer.date, style: .timer)
                                .font(.system(size: 12, weight: .medium))
                                .monospacedDigit()
                                .contentTransition(.numericText())
                        } else {
                            Text(prayer.date, format: .dateTime.hour().minute())
                                .font(.system(size: 12, weight: .medium))
                                .monospacedDigit()
                        }
                    }
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .foregroundColor(.white)
            .accessibilityElement(children: .combine)
        }
    }
}

@available(iOSApplicationExtension 17.0, *)
struct MorningPrayerWidget: Widget {
    let kind: String = "MorningPrayerWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: AllPrayersConfigurationIntent.self,
            provider: SplitPrayerProvider(isFirstHalf: true)
        ) { entry in
            PrayerView(entry: entry)
                .widgetURL(URL(string: "myapp:///"))
        }
        .configurationDisplayName(
            NSLocalizedString("morningPrayersWidgetTitle", comment: "")
        )
        .description(NSLocalizedString("morningPrayersWidgetDesc", comment: ""))
        .supportedFamilies([.accessoryRectangular])
        .contentMarginsDisabledIfAvailable()
    }
}

@available(iOSApplicationExtension 17.0, *)
struct EveningPrayerWidget: Widget {
    let kind: String = "EveningPrayerWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: AllPrayersConfigurationIntent.self,
            provider: SplitPrayerProvider(isFirstHalf: false)
        ) { entry in
            PrayerView(entry: entry)
                .widgetURL(URL(string: "myapp:///"))
        }
        .configurationDisplayName(
            NSLocalizedString("eveningPrayersWidgetTitle", comment: "")
        )
        .description(NSLocalizedString("eveningPrayersWidgetDesc", comment: ""))
        .supportedFamilies([.accessoryRectangular])
        .contentMarginsDisabledIfAvailable()
    }
}
