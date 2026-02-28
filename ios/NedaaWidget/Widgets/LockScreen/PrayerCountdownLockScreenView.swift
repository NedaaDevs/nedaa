import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Widget Configuration Intent

@available(iOS 17.0, *)
struct PrayerCountdownConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "widget_prayer_countdown_settings"
    static var description = IntentDescription("widget_prayer_countdown_settings_desc")
    
    @Parameter(title: "widget_show_timer", default: true)
    var showTimer: Bool
    
    @Parameter(title: "widget_show_sunrise", default: true)
    var showSunrise: Bool

    @Parameter(title: "widget_show_ramadan_labels", default: true)
    var showRamadanLabels: Bool
}

// MARK: - Timeline Entry

struct PrayerCountdownEntry: TimelineEntry {
    let date: Date
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
            isRamadan: isRamadan
        )
    }
}

// MARK: - Timeline Provider

@available(iOS 17.0, *)
struct CountdownLockScreenViewProvider: AppIntentTimelineProvider {
    typealias Entry = PrayerCountdownEntry
    typealias Intent = PrayerCountdownConfigurationIntent
    
    private let prayerService = PrayerDataService()
    
    func placeholder(in context: Context) -> PrayerCountdownEntry {
        PrayerCountdownEntry(
            date: Date(),
            nextPrayer: PrayerData(name: "isha", date: Date().addingTimeInterval(3600)),
            previousPrayer: PrayerData(name: "maghrib", date: Date().addingTimeInterval(-1800)),
            showTimer: true,
            showSunrise: true,
            isRamadan: false,
            showRamadanLabels: true
        )
    }

    func snapshot(for configuration: PrayerCountdownConfigurationIntent, in context: Context) async -> PrayerCountdownEntry {
        let showSunrise = configuration.showSunrise
        let showTimer = configuration.showTimer
        let nextPrayer = prayerService.getNextPrayer(showSunrise: showSunrise)
        let previousPrayer = prayerService.getPreviousPrayer(showSunrise: showSunrise)
        return PrayerCountdownEntry(
            date: Date(),
            nextPrayer: nextPrayer,
            previousPrayer: previousPrayer,
            showTimer: showTimer,
            showSunrise: showSunrise,
            isRamadan: PrayerTimelineUtils.isRamadan(Date()),
            showRamadanLabels: configuration.showRamadanLabels
        )
    }
    
    func timeline(for configuration: PrayerCountdownConfigurationIntent, in context: Context) async -> Timeline<PrayerCountdownEntry> {
        let currentDate = Date()
        let showSunrise = configuration.showSunrise
        let showTimer = configuration.showTimer

        guard let todayPrayers = prayerService.getTodaysPrayerTimes(showSunrise: showSunrise) else {
            let fallback = placeholder(in: context)
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

        var entries: [PrayerCountdownEntry] = []
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

            entries.append(PrayerCountdownEntry(
                date: entryDate,
                nextPrayer: nextPrayer,
                previousPrayer: previousPrayer,
                showTimer: showTimer,
                showSunrise: showSunrise,
                isRamadan: isRamadan,
                showRamadanLabels: configuration.showRamadanLabels
            ))
        }

        return Timeline(entries: entries, policy: .atEnd)
    }
}

@available(iOSApplicationExtension 17.0, *)
struct PrayerCountdownLockScreenView: View {
    var entry: PrayerCountdownEntry

    @Environment(\.widgetFamily) var family

    var body: some View {
        Group {
            switch family {
            case .accessoryRectangular:
                RectangularView(entry: entry)
            case .accessoryCircular:
                CircularView(entry: entry)
            default:
                Text("Select a family")
            }
        }
        .widgetURL(URL(string: "myapp:///"))
    }
}

@available(iOSApplicationExtension 17.0, *)
struct RectangularView: View {
    var entry: PrayerCountdownEntry
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                dataToShow(entry: entry, geometry: geometry, widgetFamily: .accessoryRectangular)
            }
        }.widgetBackground(Color.clear)
            .accessibilityElement(children: .combine)
    }
}

@available(iOSApplicationExtension 17.0, *)
struct CircularView: View {
    var entry: PrayerCountdownEntry

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                dataToShow(entry: entry, geometry: geometry, widgetFamily: .accessoryCircular)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }.widgetBackground(Color.clear)
            .accessibilityElement(children: .combine)
    }
}

@available(iOSApplicationExtension 17.0, *)
func dataToShow(entry: PrayerCountdownEntry, geometry: GeometryProxy, widgetFamily: WidgetFamily) -> some View {
    let fontSize: Double = widgetFamily == WidgetFamily.accessoryCircular ? 0.25 : 0.18
    let phase = PrayerTimelineUtils.timerPhase(
        at: entry.date,
        previousPrayer: entry.previousPrayer,
        nextPrayer: entry.nextPrayer,
        timerEnabled: entry.showTimer
    )
    return Group {
        switch phase {
        case .countUp(let prayer):
            VStack {
                Text(NSLocalizedString(prayer.name, comment: "Previous prayer"))
                    .multilineTextAlignment(.center)
                    .font(.system(size: geometry.size.width * fontSize))
                Text(prayer.date, style: .timer)
                    .multilineTextAlignment(.center)
                    .lineLimit(1)
                    .font(.system(size: geometry.size.width * fontSize))
                    .contentTransition(.numericText())
            }
        case .countdown(let prayer):
            VStack {
                Text(NSLocalizedString(prayer.name, comment: "Next prayer"))
                    .font(.system(size: geometry.size.width * fontSize))
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                Text(prayer.date, style: .timer)
                    .multilineTextAlignment(.center)
                    .lineLimit(1)
                    .contentTransition(.numericText())
            }
        case .absoluteTime(let prayer):
            VStack {
                Text(NSLocalizedString(prayer.name, comment: "Next prayer"))
                    .font(.system(size: geometry.size.width * fontSize))
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                Text(prayer.date, style: .time)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .font(.system(size: geometry.size.width * fontSize))
            }
        case .none:
            EmptyView()
        }
    }
}

@available(iOSApplicationExtension 17.0, *)
struct PrayerCountdownLockScreenWidget: Widget {
    let kind: String = "PrayerCountdownLockScreenWidget"
    
    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: PrayerCountdownConfigurationIntent.self,
            provider: CountdownLockScreenViewProvider()
        ) { entry in
            PrayerCountdownLockScreenView(entry: entry)
        }
        .configurationDisplayName(NSLocalizedString("nextPrayerLockScreenWidgetTitle", comment: "Lock screen widget title"))
        .description(NSLocalizedString("nextPrayerLockScreenWidgetDesc", comment: "Lock screen widget description"))
        .supportedFamilies([.accessoryCircular, .accessoryRectangular])
        .contentMarginsDisabledIfAvailable()
    }
}

// MARK: - Inline Lock Screen Widget

@available(iOS 17.0, *)
struct InlinePrayerProvider: TimelineProvider {
    typealias Entry = PrayerCountdownEntry

    private let prayerService = PrayerDataService()

    func placeholder(in context: Context) -> PrayerCountdownEntry {
        PrayerCountdownEntry(
            date: Date(),
            nextPrayer: PrayerData(name: "isha", date: Date().addingTimeInterval(3600)),
            previousPrayer: nil,
            showTimer: true,
            showSunrise: false,
            isRamadan: false,
            showRamadanLabels: true
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (PrayerCountdownEntry) -> Void) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerCountdownEntry>) -> Void) {
        let currentDate = Date()

        guard let todayPrayers = prayerService.getTodaysPrayerTimes(showSunrise: false) else {
            let fallback = placeholder(in: context)
            completion(Timeline(entries: [fallback], policy: .after(currentDate.addingTimeInterval(3600))))
            return
        }
        let tomorrowPrayers = prayerService.getTomorrowsPrayerTimes(showSunrise: false)

        let entryDates = PrayerTimelineUtils.generateEntryDates(
            from: currentDate,
            todayPrayers: todayPrayers,
            tomorrowPrayers: tomorrowPrayers,
            showTimer: true
        )

        var entries: [PrayerCountdownEntry] = []
        for entryDate in entryDates {
            let isAfterMidnight = entryDate >= Calendar.current.startOfDay(
                for: Calendar.current.date(byAdding: .day, value: 1, to: currentDate) ?? currentDate
            )
            let prayers = isAfterMidnight ? (tomorrowPrayers ?? todayPrayers) : todayPrayers
            let yesterdayPrayers = isAfterMidnight ? todayPrayers : nil

            let nextPrayer = PrayerTimelineUtils.nextPrayer(
                at: entryDate, todayPrayers: prayers, tomorrowPrayers: isAfterMidnight ? nil : tomorrowPrayers
            )
            let previousPrayer = PrayerTimelineUtils.previousPrayer(
                at: entryDate, todayPrayers: prayers, yesterdayPrayers: yesterdayPrayers
            )

            entries.append(PrayerCountdownEntry(
                date: entryDate,
                nextPrayer: nextPrayer,
                previousPrayer: previousPrayer,
                showTimer: true,
                showSunrise: false,
                isRamadan: PrayerTimelineUtils.isRamadan(currentDate),
                showRamadanLabels: true
            ))
        }

        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

@available(iOSApplicationExtension 17.0, *)
struct InlinePrayerView: View {
    var entry: PrayerCountdownEntry

    private var phase: PrayerTimelineUtils.TimerPhase {
        PrayerTimelineUtils.timerPhase(
            at: entry.date,
            previousPrayer: entry.previousPrayer,
            nextPrayer: entry.nextPrayer,
            timerEnabled: true
        )
    }

    var body: some View {
        switch phase {
        case .countUp(let prayer):
            inlineContent(prayer: prayer, style: .timer)
        case .countdown(let prayer):
            inlineContent(prayer: prayer, style: .timer)
        case .absoluteTime(let prayer):
            inlineContent(prayer: prayer, style: .time)
        case .none:
            EmptyView()
        }
    }

    private enum TimeStyle {
        case timer, time
    }

    @ViewBuilder
    private func inlineContent(prayer: PrayerData, style: TimeStyle) -> some View {
        ViewThatFits {
            Label {
                Text(NSLocalizedString(prayer.name, comment: ""))
                + Text(" ")
                + timeText(for: prayer, style: style)
            } icon: {
                Image(systemName: "moon.stars")
            }

            Text(NSLocalizedString(prayer.name, comment: ""))
            + Text(" ")
            + timeText(for: prayer, style: style)
        }
        .widgetAccentable()
    }

    private func timeText(for prayer: PrayerData, style: TimeStyle) -> Text {
        switch style {
        case .timer:
            return Text(prayer.date, style: .timer)
        case .time:
            return Text(prayer.date, style: .time)
        }
    }
}

@available(iOSApplicationExtension 17.0, *)
struct InlinePrayerWidget: Widget {
    let kind: String = "InlinePrayerWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: InlinePrayerProvider()) { entry in
            InlinePrayerView(entry: entry)
                .widgetURL(URL(string: "myapp:///"))
        }
        .configurationDisplayName(NSLocalizedString("inlinePrayerWidgetTitle", comment: ""))
        .description(NSLocalizedString("inlinePrayerWidgetDesc", comment: ""))
        .supportedFamilies([.accessoryInline])
        .contentMarginsDisabledIfAvailable()
    }
}

@available(iOSApplicationExtension 17.0, *)
struct PrayerCountdownLockScreenView_Previews: PreviewProvider {
    static var previews: some View {
        PrayerCountdownLockScreenView(
            entry: PrayerCountdownEntry(
                date: Date(),
                nextPrayer: PrayerData(name: "Maghrib", date: Date()),
                previousPrayer: PrayerData(name: "Asr", date: Date()),
                showTimer: true,
                showSunrise: true,
                isRamadan: false,
                showRamadanLabels: true
            )
        )
        .previewContext(WidgetPreviewContext(family: .accessoryCircular))
    }
}
