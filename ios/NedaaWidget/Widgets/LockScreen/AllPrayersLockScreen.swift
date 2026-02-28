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

    @Parameter(title: "widget_show_ramadan_labels", default: true)
    var showRamadanLabels: Bool
}

// MARK: - Timeline Entry

struct AllPrayersEntry: TimelineEntry {
    let date: Date
    let allPrayers: [PrayerData]?
    let nextPrayer: PrayerData?
    let previousPrayer: PrayerData?
    let showTimer: Bool
    let showSunrise: Bool
    let isRamadan: Bool
    let showRamadanLabels: Bool

    var relevance: TimelineEntryRelevance? {
        prayerTimelineRelevance(
            nextPrayerDate: nextPrayer?.date,
            previousPrayerDate: previousPrayer?.date,
            currentDate: date,
            isRamadan: isRamadan,
            imsakDate: nil,
            maghribDate: isRamadan ? allPrayers?.first(where: { $0.name == "maghrib" })?.date : nil
        )
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
            showSunrise: true,
            isRamadan: false,
            showRamadanLabels: true
        )
    }

    func snapshot(for configuration: AllPrayersConfigurationIntent, in context: Context) async -> AllPrayersEntry {
        let currentDate = Date()
        return AllPrayersEntry(
            date: currentDate,
            allPrayers: isFirstHalf ? morningPrayers : eveningPrayers,
            nextPrayer: PrayerData(name: "Fajr", date: currentDate),
            previousPrayer: nil,
            showTimer: true,
            showSunrise: true,
            isRamadan: PrayerTimelineUtils.isRamadan(currentDate),
            showRamadanLabels: configuration.showRamadanLabels
        )
    }
    
    func timeline(for configuration: AllPrayersConfigurationIntent, in context: Context) async -> Timeline<AllPrayersEntry> {
        let currentDate = Date()
        let showSunrise = configuration.showSunrise
        let showTimer = configuration.showTimer

        let todaysPrayers = prayerService.getTodaysPrayerTimes(showSunrise: showSunrise)
        let tomorrowsPrayers = prayerService.getTomorrowsPrayerTimes(showSunrise: showSunrise)

        guard let allTodayPrayers = todaysPrayers else {
            let fallback = placeholder(in: context)
            return Timeline(entries: [fallback], policy: .after(currentDate.addingTimeInterval(3600)))
        }

        let entryDates = PrayerTimelineUtils.generateEntryDates(
            from: currentDate,
            todayPrayers: allTodayPrayers,
            tomorrowPrayers: tomorrowsPrayers,
            showTimer: showTimer
        )

        var entries: [AllPrayersEntry] = []
        for entryDate in entryDates {
            let isAfterMidnight = entryDate >= Calendar.current.startOfDay(
                for: Calendar.current.date(byAdding: .day, value: 1, to: currentDate) ?? currentDate
            )

            let allPrayers = isAfterMidnight ? (tomorrowsPrayers ?? allTodayPrayers) : allTodayPrayers
            let yesterdayPrayers = isAfterMidnight ? allTodayPrayers : nil

            let isAfterLastPrayer = entryDate > (allPrayers.last?.date ?? Date())
            let sourcePrayers: [PrayerData]
            if isAfterLastPrayer, let tomorrow = (isAfterMidnight ? nil : tomorrowsPrayers) {
                sourcePrayers = tomorrow
            } else {
                sourcePrayers = allPrayers
            }

            let displayPrayers = sourcePrayers.enumerated().filter { index, _ in
                isFirstHalf ? index < 3 : index >= 3
            }.map { $0.element }

            let nextPrayer = PrayerTimelineUtils.nextPrayer(
                at: entryDate, todayPrayers: allPrayers, tomorrowPrayers: isAfterMidnight ? nil : tomorrowsPrayers
            )
            let previousPrayer = PrayerTimelineUtils.previousPrayer(
                at: entryDate, todayPrayers: allPrayers, yesterdayPrayers: yesterdayPrayers
            )

            entries.append(AllPrayersEntry(
                date: entryDate,
                allPrayers: displayPrayers,
                nextPrayer: nextPrayer,
                previousPrayer: previousPrayer,
                showTimer: showTimer,
                showSunrise: showSunrise,
                isRamadan: PrayerTimelineUtils.isRamadan(currentDate),
                showRamadanLabels: configuration.showRamadanLabels
            ))
        }

        return Timeline(entries: entries, policy: .atEnd)
    }
}

@available(iOSApplicationExtension 17.0, *)
struct PrayerView: View {
    var entry: AllPrayersEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        if let prayers = entry.allPrayers {
            VStack(alignment: .leading, spacing: 2) {
                ForEach(prayers, id: \.id) { prayer in
                    let isNext = prayer.isSame(as: entry.nextPrayer)
                    let isPast = prayer.isPast(at: entry.date)
                    let minutesToPrayer = Calendar.current.dateComponents(
                        [.minute], from: entry.date, to: prayer.date
                    ).minute ?? 0
                    let showCountdown = isNext && minutesToPrayer > 0 && minutesToPrayer <= 60 && entry.showTimer
                    let minutesSincePrayer = Calendar.current.dateComponents(
                        [.minute], from: prayer.date, to: entry.date
                    ).minute ?? 0
                    let isPreviousActive = prayer.isSame(as: entry.previousPrayer) && minutesSincePrayer >= 0 && minutesSincePrayer <= 30 && entry.showTimer

                    HStack(spacing: 8) {
                        Circle()
                            .stroke(Color.white.opacity(0.6), lineWidth: 1)
                            .overlay(
                                Circle()
                                    .fill(isNext || isPreviousActive ? .white : .clear)
                                    .frame(width: 6, height: 6)
                            )
                            .frame(width: 8, height: 8)

                        Text(NSLocalizedString(prayer.name, comment: ""))
                            .font(.system(size: 14, weight: .medium))
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .opacity(isPast && !isPreviousActive ? 0.6 : 1.0)

                        if isPreviousActive {
                            Text(prayer.date, style: .timer)
                                .font(.system(size: 12, weight: .medium))
                                .monospacedDigit()
                                .contentTransition(.numericText())
                        } else if showCountdown {
                            Text(prayer.date, style: .timer)
                                .font(.system(size: 12, weight: .medium))
                                .monospacedDigit()
                                .contentTransition(.numericText())
                        } else {
                            Text(prayer.date, format: .dateTime.hour().minute())
                                .font(.system(size: 12, weight: .medium))
                                .monospacedDigit()
                                .opacity(isPast ? 0.6 : 1.0)
                        }
                    }
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .foregroundStyle(.white)
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
