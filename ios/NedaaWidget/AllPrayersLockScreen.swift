import Intents
import SwiftUI
import WidgetKit

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

struct SplitPrayerProvider: IntentTimelineProvider {
    let isFirstHalf: Bool

    typealias Entry = AllPrayerEntry
    typealias Intent = ConfigurationIntent

    func placeholder(in context: Context) -> AllPrayerEntry {
        AllPrayerEntry(
            date: Date(),
            configuration: ConfigurationIntent(),
            allPrayers: isFirstHalf ? morningPrayers : eveningPrayers,
            nextPrayer: PrayerData(name: "Fajr", date: Date())
        )
    }

    func getSnapshot(
        for configuration: ConfigurationIntent, in context: Context,
        completion: @escaping (AllPrayerEntry) -> Void
    ) {
        let entry = placeholder(in: context)
        completion(entry)
    }

    func getTimeline(
        for configuration: ConfigurationIntent, in context: Context,
        completion: @escaping (Timeline<AllPrayerEntry>) -> Void
    ) {
        let prayerService = PrayerDataService()
        let showSunrise = configuration.showSunrise as! Bool?
        var todaysPrayers = prayerService.getTodaysPrayerTimes(
            showSunrise: showSunrise ?? true)
        let nextPrayer =
            prayerService.getNextPrayer(showSunrise: showSunrise ?? true)
            ?? PrayerData(name: "DB ERROR", date: Date())
        let previousPrayer =
            prayerService.getPreviousPrayer(showSunrise: showSunrise ?? true)
            ?? PrayerData(name: "DB ERROR", date: Date())
        let currentDate = Date()

        if currentDate > todaysPrayers?.last?.date ?? Date() {
            todaysPrayers = prayerService.getTomorrowsPrayerTimes(
                showSunrise: showSunrise ?? true)
        }

        let displayPrayers = todaysPrayers?.enumerated().filter { index, _ in
            isFirstHalf ? index < 3 : index >= 3
        }.map { $0.element }

        let entry = AllPrayerEntry(
            date: currentDate,
            configuration: configuration,
            allPrayers: displayPrayers,
            nextPrayer: nextPrayer
        )

        let nextUpdateDate = calculateNextUpdateDate(
            currentDate: currentDate,
            nextPrayerDate: nextPrayer.date,
            previousPrayerDate: previousPrayer.date
        )

        let timeline = Timeline(
            entries: [entry], policy: .after(nextUpdateDate))

        completion(timeline)
    }

    func calculateNextUpdateDate(
        currentDate: Date, nextPrayerDate: Date, previousPrayerDate: Date
    ) -> Date {
        let timeIntervalToNextPrayer = nextPrayerDate.timeIntervalSince(
            currentDate)
        let timeIntervalSincePreviousPrayer = currentDate.timeIntervalSince(
            previousPrayerDate)

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

@available(iOSApplicationExtension 16.0, *)
struct PrayerView: View {
    var entry: AllPrayerEntry
    @Environment(\.widgetFamily) var family

    func timeToNextPrayer(prayer: PrayerData) -> Int? {
        if prayer.name == entry.nextPrayer?.name {
            return Calendar.current.dateComponents(
                [.minute], from: Date(), to: prayer.date
            ).minute
        }
        return nil
    }

    var body: some View {
        if let prayers = entry.allPrayers {
            VStack(alignment: .leading, spacing: 2) {
                ForEach(prayers, id: \.name) { prayer in
                    let isNext = prayer.name == entry.nextPrayer?.name
                    let minutesUntilPrayer = timeToNextPrayer(prayer: prayer)
                    let showCountdown =
                        isNext && (minutesUntilPrayer ?? 0) <= 60
                        && entry.configuration.showTimer == true

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
        }
    }
}


@available(iOSApplicationExtension 16.0, *)
struct MorningPrayerWidget: Widget {
    let kind: String = "MorningPrayerWidget"

    var body: some WidgetConfiguration {
        IntentConfiguration(
            kind: kind, intent: ConfigurationIntent.self,
            provider: SplitPrayerProvider(isFirstHalf: true)
        ) { entry in
            PrayerView(entry: entry)
        }
        .configurationDisplayName(
            NSLocalizedString("morningPrayersWidgetTitle", comment: "")
        )
        .description(NSLocalizedString("morningPrayersWidgetDesc", comment: ""))
        .supportedFamilies([.accessoryRectangular])
        .contentMarginsDisabledIfAvailable()
    }
}

@available(iOSApplicationExtension 16.0, *)
struct EveningPrayerWidget: Widget {
    let kind: String = "EveningPrayerWidget"

    var body: some WidgetConfiguration {
        IntentConfiguration(
            kind: kind, intent: ConfigurationIntent.self,
            provider: SplitPrayerProvider(isFirstHalf: false)
        ) { entry in
            PrayerView(entry: entry)
        }
        .configurationDisplayName(
            NSLocalizedString("eveningPrayersWidgetTitle", comment: "")
        )
        .description(NSLocalizedString("eveningPrayersWidgetDesc", comment: ""))
        .supportedFamilies([.accessoryRectangular])
        .contentMarginsDisabledIfAvailable()
    }
}
