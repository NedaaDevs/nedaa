import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Timeline Provider

@available(iOS 17.0, *)
struct CombinedPrayerProvider: AppIntentTimelineProvider {
    typealias Entry = AllPrayersEntry
    typealias Intent = AllPrayersConfigurationIntent

    private let prayerService = PrayerDataService()

    func placeholder(in context: Context) -> AllPrayersEntry {
        AllPrayersEntry(
            date: Date(),
            allPrayers: morningPrayers,
            nextPrayer: PrayerData(name: "Fajr", date: Date()),
            previousPrayer: nil,
            showTimer: true,
            showSunrise: true,
            isRamadan: false,
            showRamadanLabels: true
        )
    }

    func snapshot(for configuration: AllPrayersConfigurationIntent, in context: Context) async -> AllPrayersEntry {
        placeholder(in: context)
    }

    func timeline(for configuration: AllPrayersConfigurationIntent, in context: Context) async -> Timeline<AllPrayersEntry> {
        let currentDate = Date()
        let showSunrise = configuration.showSunrise
        let showTimer = configuration.showTimer

        guard let allTodayPrayers = prayerService.getTodaysPrayerTimes(showSunrise: showSunrise) else {
            let fallback = placeholder(in: context)
            return Timeline(entries: [fallback], policy: .after(currentDate.addingTimeInterval(3600)))
        }
        let tomorrowsPrayers = prayerService.getTomorrowsPrayerTimes(showSunrise: showSunrise)

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

            let nextPrayer = PrayerTimelineUtils.nextPrayer(
                at: entryDate, todayPrayers: allPrayers, tomorrowPrayers: isAfterMidnight ? nil : tomorrowsPrayers
            )
            let previousPrayer = PrayerTimelineUtils.previousPrayer(
                at: entryDate, todayPrayers: allPrayers, yesterdayPrayers: yesterdayPrayers
            )

            let focus = PrayerTimelineUtils.focusPrayer(
                at: entryDate, previousPrayer: previousPrayer, nextPrayer: nextPrayer, timerEnabled: showTimer
            )
            let isFirstHalf = PrayerTimelineUtils.showsFirstHalf(focus: focus, in: sourcePrayers)

            let displayPrayers = sourcePrayers.enumerated().filter { index, _ in
                isFirstHalf ? index < 3 : index >= 3
            }.map { $0.element }

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

// MARK: - View

@available(iOSApplicationExtension 17.0, *)
struct CombinedPrayerView: View {
    var entry: AllPrayersEntry

    var body: some View {
        if let prayers = entry.allPrayers {
            VStack(alignment: .leading, spacing: 2) {
                ForEach(prayers, id: \.id) { prayer in
                    row(for: prayer)
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .accessibilityElement(children: .combine)
        }
    }

    @ViewBuilder
    private func row(for prayer: PrayerData) -> some View {
        let isNext = prayer.isSame(as: entry.nextPrayer)
        let minutesToPrayer = Calendar.current.dateComponents(
            [.minute], from: entry.date, to: prayer.date
        ).minute ?? 0
        let showCountdown = isNext && minutesToPrayer > 0 && minutesToPrayer <= 60 && entry.showTimer
        let minutesSincePrayer = Calendar.current.dateComponents(
            [.minute], from: prayer.date, to: entry.date
        ).minute ?? 0
        let isPreviousActive = prayer.isSame(as: entry.previousPrayer)
            && minutesSincePrayer >= 0 && minutesSincePrayer <= 30 && entry.showTimer
        let isActive = isNext || isPreviousActive
        let isPast = prayer.isPast(at: entry.date)

        let content = HStack(spacing: 8) {
            Text(NSLocalizedString(prayer.name, comment: ""))
                .font(.system(size: 14, weight: isActive ? .semibold : .medium))
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)

            if isPreviousActive || showCountdown {
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
        .opacity(isPast && !isPreviousActive ? 0.55 : 1.0)

        if isActive {
            content.widgetAccentable()
        } else {
            content
        }
    }
}

// MARK: - Widget

@available(iOSApplicationExtension 17.0, *)
struct AllPrayersCombinedWidget: Widget {
    let kind: String = "AllPrayersCombinedWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: AllPrayersConfigurationIntent.self,
            provider: CombinedPrayerProvider()
        ) { entry in
            CombinedPrayerView(entry: entry)
                .widgetURL(URL(string: "myapp:///"))
        }
        .configurationDisplayName(NSLocalizedString("allPrayersCombinedWidgetTitle", comment: ""))
        .description(NSLocalizedString("allPrayersCombinedWidgetDesc", comment: ""))
        .supportedFamilies([.accessoryRectangular])
        .contentMarginsDisabledIfAvailable()
    }
}
