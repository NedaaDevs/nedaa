import SwiftUI
import WidgetKit
import AppIntents

// MARK: - Widget Configuration Intent

@available(iOS 17.0, *)
struct PrayerTimesConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "widget_prayer_times_settings"
    static var description = IntentDescription("widget_prayer_times_settings_desc")
    
    @Parameter(title: "widget_show_timer", default: true)
    var showTimer: Bool
    
    @Parameter(title: "widget_show_sunrise", default: true)
    var showSunrise: Bool

    @Parameter(title: "widget_show_ramadan_labels", default: true)
    var showRamadanLabels: Bool
}

// MARK: - Localization Extension
@available(iOS 17.0, *)
extension LocalizedStringResource {
    // Widget Configuration
    static let widgetPrayerTimesSettings = LocalizedStringResource(
        "widget_prayer_times_settings",
        defaultValue: "Prayer Times Settings",
        table: "Localizable",
        locale: .current,
        bundle: .main,
        comment: "Widget configuration title"
    )
    
    static let widgetPrayerTimesSettingsDesc = LocalizedStringResource(
        "widget_prayer_times_settings_desc",
        defaultValue: "Customize your prayer times widget display",
        table: "Localizable",
        locale: .current,
        bundle: .main,
        comment: "Widget configuration description"
    )
    
    static let widgetShowTimer = LocalizedStringResource(
        "widget_show_timer",
        defaultValue: "Show Timer",
        table: "Localizable",
        locale: .current,
        bundle: .main,
        comment: "Show timer option"
    )
    
    static let widgetShowSunrise = LocalizedStringResource(
        "widget_show_sunrise",
        defaultValue: "Show Sunrise",
        table: "Localizable",
        locale: .current,
        bundle: .main,
        comment: "Show sunrise option"
    )
}

// MARK: - Timeline Entry

struct PrayerHomeScreenEntry: TimelineEntry {
    let date: Date
    let previousPrayer: PrayerData?
    let nextPrayer: PrayerData?
    let allPrayers: [PrayerData]
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
            maghribDate: isRamadan ? allPrayers.first(where: { $0.name == "maghrib" })?.date : nil
        )
    }

    static var preview: PrayerHomeScreenEntry {
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

        return PrayerHomeScreenEntry(
            date: now,
            previousPrayer: prayers[2],
            nextPrayer: prayers[3],
            allPrayers: prayers,
            showTimer: true,
            showSunrise: true,
            isRamadan: false,
            showRamadanLabels: true
        )
    }
}

// Extension to add convenience properties
extension PrayerData {
    /// Check if prayer is past relative to a reference date (for widget archived views)
    func isPast(at referenceDate: Date) -> Bool {
        date < referenceDate
    }

    /// Kept for non-widget code compatibility
    var isPast: Bool {
        date < Date()
    }

    func isSame(as other: PrayerData?) -> Bool {
        guard let other = other else { return false }
        return self.name == other.name && self.date == other.date
    }
}

// MARK: - Timeline Provider

@available(iOS 17.0, *)
struct PrayerHomeScreenProvider: AppIntentTimelineProvider {
    typealias Entry = PrayerHomeScreenEntry
    typealias Intent = PrayerTimesConfigurationIntent
    
    private let prayerService = PrayerDataService()

    func placeholder(in context: Context) -> PrayerHomeScreenEntry {
        PrayerHomeScreenEntry.preview
    }

    func snapshot(for configuration: PrayerTimesConfigurationIntent, in context: Context) async -> PrayerHomeScreenEntry {
        return createEntry(for: Date(), configuration: configuration)
    }

    func timeline(for configuration: PrayerTimesConfigurationIntent, in context: Context) async -> Timeline<PrayerHomeScreenEntry> {
        let currentDate = Date()
        let showSunrise = configuration.showSunrise
        let showTimer = configuration.showTimer

        guard let todayPrayers = prayerService.getTodaysPrayerTimes(showSunrise: showSunrise) else {
            let fallback = PrayerHomeScreenEntry.preview
            return Timeline(entries: [fallback], policy: .after(currentDate.addingTimeInterval(3600)))
        }
        let tomorrowPrayers = prayerService.getTomorrowsPrayerTimes(showSunrise: showSunrise)

        let isRamadan = PrayerTimelineUtils.isRamadan(currentDate)
        let imsakTime = isRamadan ? prayerService.getImsakTime()?.date : nil
        let maghribTime = isRamadan ? todayPrayers.first(where: { $0.name == "maghrib" })?.date : nil

        let entryDates = PrayerTimelineUtils.generateEntryDates(
            from: currentDate,
            todayPrayers: todayPrayers,
            tomorrowPrayers: tomorrowPrayers,
            isRamadan: isRamadan,
            imsakTime: imsakTime,
            maghribTime: maghribTime,
            showTimer: showTimer
        )

        var entries: [PrayerHomeScreenEntry] = []
        for entryDate in entryDates {
            let isAfterMidnight = entryDate >= Calendar.current.startOfDay(
                for: Calendar.current.date(byAdding: .day, value: 1, to: currentDate) ?? currentDate
            )

            let prayers = isAfterMidnight ? (tomorrowPrayers ?? todayPrayers) : todayPrayers
            let yesterdayPrayers = isAfterMidnight ? todayPrayers : nil

            let previousPrayer = PrayerTimelineUtils.previousPrayer(
                at: entryDate, todayPrayers: prayers, yesterdayPrayers: yesterdayPrayers
            )
            let nextPrayer = PrayerTimelineUtils.nextPrayer(
                at: entryDate, todayPrayers: prayers, tomorrowPrayers: isAfterMidnight ? nil : tomorrowPrayers
            )

            let entry = PrayerHomeScreenEntry(
                date: entryDate,
                previousPrayer: previousPrayer,
                nextPrayer: nextPrayer,
                allPrayers: prayers,
                showTimer: showTimer,
                showSunrise: showSunrise,
                isRamadan: isRamadan,
                showRamadanLabels: configuration.showRamadanLabels
            )
            entries.append(entry)
        }

        return Timeline(entries: entries, policy: .atEnd)
    }

    private func createEntry(for date: Date, configuration: PrayerTimesConfigurationIntent) -> PrayerHomeScreenEntry {
        let showSunrise = configuration.showSunrise
        let showTimer = configuration.showTimer
        
        guard let prayerTimes = prayerService.getTodaysPrayerTimes(showSunrise: showSunrise) else {
            // Fallback to default times if database fails
            return PrayerHomeScreenEntry.preview
        }

        let prayers = prayerTimes

        // Get previous and next prayers
        let previousPrayer = prayerService.getPreviousPrayer(showSunrise: showSunrise)
        let nextPrayer = prayerService.getNextPrayer(showSunrise: showSunrise)

        return PrayerHomeScreenEntry(
            date: date,
            previousPrayer: previousPrayer,
            nextPrayer: nextPrayer,
            allPrayers: prayers,
            showTimer: showTimer,
            showSunrise: showSunrise,
            isRamadan: PrayerTimelineUtils.isRamadan(date),
            showRamadanLabels: configuration.showRamadanLabels
        )
    }
}
