import SwiftUI
import WidgetKit
import AppIntents

// MARK: - Widget Configuration Intent

@available(iOS 17.0, *)
struct SuhoorIftarConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "widget_suhoor_iftar_settings"
    static var description = IntentDescription("widget_suhoor_iftar_settings_desc")
}

// MARK: - Phase Enum

enum SuhoorIftarPhase {
    case beforeImsak(imsakDate: Date)
    case fasting(iftarDate: Date)
    case afterIftar(ramadanDay: Int)
    case outsideRamadan
}

// MARK: - Timeline Entry

struct SuhoorIftarEntry: TimelineEntry {
    let date: Date
    let phase: SuhoorIftarPhase
    let isRamadan: Bool
    let ramadanDay: Int

    var relevance: TimelineEntryRelevance? {
        switch phase {
        case .beforeImsak(let imsakDate):
            return prayerTimelineRelevance(
                nextPrayerDate: nil,
                previousPrayerDate: nil,
                currentDate: date,
                isRamadan: true,
                imsakDate: imsakDate,
                maghribDate: nil
            )
        case .fasting(let iftarDate):
            return prayerTimelineRelevance(
                nextPrayerDate: nil,
                previousPrayerDate: nil,
                currentDate: date,
                isRamadan: true,
                imsakDate: nil,
                maghribDate: iftarDate
            )
        case .afterIftar:
            return TimelineEntryRelevance(score: 0.1, duration: 3600)
        case .outsideRamadan:
            return nil
        }
    }

    static var preview: SuhoorIftarEntry {
        let now = Date()
        let calendar = Calendar.current
        let iftarDate = calendar.date(bySettingHour: 18, minute: 30, second: 0, of: now)!
        return SuhoorIftarEntry(
            date: now,
            phase: .fasting(iftarDate: iftarDate),
            isRamadan: true,
            ramadanDay: 15
        )
    }
}

// MARK: - Timeline Provider

@available(iOS 17.0, *)
struct SuhoorIftarProvider: AppIntentTimelineProvider {
    typealias Entry = SuhoorIftarEntry
    typealias Intent = SuhoorIftarConfigurationIntent

    private let prayerService = PrayerDataService()

    func placeholder(in context: Context) -> SuhoorIftarEntry {
        SuhoorIftarEntry.preview
    }

    func snapshot(for configuration: SuhoorIftarConfigurationIntent, in context: Context) async -> SuhoorIftarEntry {
        createEntry(for: Date())
    }

    func timeline(for configuration: SuhoorIftarConfigurationIntent, in context: Context) async -> Timeline<SuhoorIftarEntry> {
        let currentDate = Date()
        let isRamadan = PrayerTimelineUtils.isRamadan(currentDate)

        guard isRamadan else {
            let entry = SuhoorIftarEntry(
                date: currentDate,
                phase: .outsideRamadan,
                isRamadan: false,
                ramadanDay: 0
            )
            return Timeline(entries: [entry], policy: .atEnd)
        }

        let imsakTime = prayerService.getImsakTime()?.date
        let todayPrayers = prayerService.getTodaysPrayerTimes(showSunrise: false)
        let maghribTime = todayPrayers?.first(where: { $0.name == "maghrib" })?.date

        let tomorrowPrayers = prayerService.getTomorrowsPrayerTimes(showSunrise: false)
        let tomorrowImsakTime: Date? = {
            guard let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: currentDate) else {
                return nil
            }
            return prayerService.getImsakTime(for: tomorrow)?.date
        }()

        var entryDates: Set<Date> = []

        // Current time
        entryDates.insert(currentDate)

        // Imsak time (transition: beforeImsak -> fasting)
        if let imsak = imsakTime, imsak > currentDate {
            entryDates.insert(imsak)
        }

        // Maghrib time (transition: fasting -> afterIftar)
        if let maghrib = maghribTime, maghrib > currentDate {
            entryDates.insert(maghrib)
        }

        // Midnight (day rollover)
        let startOfTomorrow = Calendar.current.startOfDay(
            for: Calendar.current.date(byAdding: .day, value: 1, to: currentDate) ?? currentDate
        )
        entryDates.insert(startOfTomorrow)

        // Tomorrow's imsak -45min (suhoor urgency)
        if let tomorrowImsak = tomorrowImsakTime, tomorrowImsak.addingTimeInterval(-2700) > currentDate {
            entryDates.insert(tomorrowImsak.addingTimeInterval(-2700))
        }

        let sortedDates = entryDates.filter { $0 >= currentDate }.sorted()

        var entries: [SuhoorIftarEntry] = []
        for entryDate in sortedDates {
            let entry = createEntry(for: entryDate, imsakTime: imsakTime, maghribTime: maghribTime, tomorrowImsakTime: tomorrowImsakTime)
            entries.append(entry)
        }

        return Timeline(entries: entries, policy: .atEnd)
    }

    // MARK: - Entry Creation

    private func createEntry(for date: Date) -> SuhoorIftarEntry {
        let isRamadan = PrayerTimelineUtils.isRamadan(date)
        guard isRamadan else {
            return SuhoorIftarEntry(
                date: date,
                phase: .outsideRamadan,
                isRamadan: false,
                ramadanDay: 0
            )
        }

        let imsakTime = prayerService.getImsakTime()?.date
        let todayPrayers = prayerService.getTodaysPrayerTimes(showSunrise: false)
        let maghribTime = todayPrayers?.first(where: { $0.name == "maghrib" })?.date

        return createEntry(for: date, imsakTime: imsakTime, maghribTime: maghribTime, tomorrowImsakTime: nil)
    }

    private func createEntry(
        for date: Date,
        imsakTime: Date?,
        maghribTime: Date?,
        tomorrowImsakTime: Date?
    ) -> SuhoorIftarEntry {
        let isRamadan = PrayerTimelineUtils.isRamadan(date)
        let ramadanDay = PrayerTimelineUtils.ramadanDay(date)

        guard isRamadan else {
            return SuhoorIftarEntry(
                date: date,
                phase: .outsideRamadan,
                isRamadan: false,
                ramadanDay: 0
            )
        }

        let phase = determinePhase(
            at: date,
            imsakTime: imsakTime,
            maghribTime: maghribTime,
            tomorrowImsakTime: tomorrowImsakTime,
            ramadanDay: ramadanDay
        )

        return SuhoorIftarEntry(
            date: date,
            phase: phase,
            isRamadan: true,
            ramadanDay: ramadanDay
        )
    }

    private func determinePhase(
        at date: Date,
        imsakTime: Date?,
        maghribTime: Date?,
        tomorrowImsakTime: Date?,
        ramadanDay: Int
    ) -> SuhoorIftarPhase {
        // Before imsak: suhoor countdown
        if let imsak = imsakTime, date < imsak {
            return .beforeImsak(imsakDate: imsak)
        }

        // After imsak, before maghrib: fasting / iftar countdown
        if let maghrib = maghribTime, date < maghrib {
            return .fasting(iftarDate: maghrib)
        }

        // After maghrib, before midnight: day complete
        if let maghrib = maghribTime, date >= maghrib {
            // Check if tomorrow's imsak is available for suhoor countdown
            if let tomorrowImsak = tomorrowImsakTime, date >= tomorrowImsak.addingTimeInterval(-2700) {
                return .beforeImsak(imsakDate: tomorrowImsak)
            }
            return .afterIftar(ramadanDay: ramadanDay)
        }

        return .afterIftar(ramadanDay: ramadanDay)
    }
}

// MARK: - Widget View

@available(iOSApplicationExtension 17.0, *)
struct SuhoorIftarWidgetView: View {
    let entry: SuhoorIftarEntry
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        Group {
            switch entry.phase {
            case .beforeImsak(let imsakDate):
                beforeImsakView(imsakDate: imsakDate)
            case .fasting(let iftarDate):
                fastingView(iftarDate: iftarDate)
            case .afterIftar(let ramadanDay):
                afterIftarView(ramadanDay: ramadanDay)
            case .outsideRamadan:
                outsideRamadanView
            }
        }
        .widgetURL(URL(string: "myapp:///"))
    }

    // MARK: - Before Imsak (Suhoor)

    private func beforeImsakView(imsakDate: Date) -> some View {
        VStack(spacing: 4) {
            Image(systemName: WidgetIcons.prayerIcon(for: "isha"))
                .font(.system(size: 16))
                .foregroundStyle(NedaaColors.ramadanAccent(for: colorScheme))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 4)

            Spacer(minLength: 0)

            VStack(spacing: 2) {
                Text(NSLocalizedString("suhoor", comment: ""))
                    .font(WidgetTypography.smallPrayerName)
                    .foregroundStyle(NedaaColors.ramadanAccent(for: colorScheme))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                Text(imsakDate, style: .timer)
                    .font(WidgetTypography.smallTimer)
                    .foregroundStyle(NedaaColors.text(for: colorScheme))
                    .monospacedDigit()
                    .numericContentTransition()

                Text(imsakDate, style: .time)
                    .font(WidgetTypography.smallCaption)
                    .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
            }

            Spacer(minLength: 0)

            ramadanDayBadge
                .padding(.bottom, 4)
        }
        .padding(.horizontal, 12)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Fasting (Iftar Countdown)

    private func fastingView(iftarDate: Date) -> some View {
        VStack(spacing: 4) {
            Image(systemName: WidgetIcons.prayerIcon(for: "iftar"))
                .font(.system(size: 16))
                .foregroundStyle(NedaaColors.ramadanAccent(for: colorScheme))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 4)

            Spacer(minLength: 0)

            VStack(spacing: 2) {
                Text(NSLocalizedString("iftar", comment: ""))
                    .font(WidgetTypography.smallPrayerName)
                    .foregroundStyle(NedaaColors.ramadanAccent(for: colorScheme))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                Text(iftarDate, style: .timer)
                    .font(WidgetTypography.smallTimer)
                    .foregroundStyle(NedaaColors.text(for: colorScheme))
                    .monospacedDigit()
                    .numericContentTransition()

                Text(iftarDate, style: .time)
                    .font(WidgetTypography.smallCaption)
                    .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
            }

            Spacer(minLength: 0)

            ramadanDayBadge
                .padding(.bottom, 4)
        }
        .padding(.horizontal, 12)
        .accessibilityElement(children: .combine)
    }

    // MARK: - After Iftar (Day Complete)

    private func afterIftarView(ramadanDay: Int) -> some View {
        VStack(spacing: 4) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 16))
                .foregroundStyle(NedaaColors.completed(for: colorScheme))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 4)

            Spacer(minLength: 0)

            VStack(spacing: 4) {
                Text(String(format: NSLocalizedString("widget_ramadan_day_complete", comment: ""), ramadanDay))
                    .font(WidgetTypography.smallPrayerName)
                    .foregroundStyle(NedaaColors.completed(for: colorScheme))
                    .lineLimit(2)
                    .minimumScaleFactor(0.7)
                    .multilineTextAlignment(.center)
            }

            Spacer(minLength: 0)

            ramadanDayBadge
                .padding(.bottom, 4)
        }
        .padding(.horizontal, 12)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Outside Ramadan

    private var outsideRamadanView: some View {
        VStack(spacing: 4) {
            Image(systemName: "moon.stars.fill")
                .font(.system(size: 16))
                .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 4)

            Spacer(minLength: 0)

            VStack(spacing: 4) {
                Text(NSLocalizedString("widget_ramadan_placeholder", comment: ""))
                    .font(WidgetTypography.smallPrayerName)
                    .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                    .lineLimit(2)
                    .minimumScaleFactor(0.7)
                    .multilineTextAlignment(.center)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Ramadan Day Badge

    private var ramadanDayBadge: some View {
        Text(String(format: NSLocalizedString("widget_ramadan_day", comment: ""), entry.ramadanDay))
            .font(WidgetTypography.smallHijri)
            .foregroundStyle(NedaaColors.ramadanAccent(for: colorScheme))
            .lineLimit(1)
    }
}

// MARK: - Widget Definition

@available(iOSApplicationExtension 17.0, *)
struct SuhoorIftarWidget: Widget {
    let kind: String = "SuhoorIftarWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: SuhoorIftarConfigurationIntent.self,
            provider: SuhoorIftarProvider()
        ) { entry in
            SuhoorIftarWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    WidgetBackgroundView()
                }
        }
        .configurationDisplayName(NSLocalizedString("suhoorIftarWidgetTitle", comment: ""))
        .description(NSLocalizedString("suhoorIftarWidgetDesc", comment: ""))
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabledIfAvailable()
    }
}

// MARK: - Previews

#if swift(>=5.9)
@available(iOS 17.0, *)
#Preview("Suhoor", as: .systemSmall) {
    SuhoorIftarWidget()
} timeline: {
    SuhoorIftarEntry(
        date: Date(),
        phase: .beforeImsak(imsakDate: Date().addingTimeInterval(3600)),
        isRamadan: true,
        ramadanDay: 15
    )
}

@available(iOS 17.0, *)
#Preview("Fasting", as: .systemSmall) {
    SuhoorIftarWidget()
} timeline: {
    SuhoorIftarEntry.preview
}

@available(iOS 17.0, *)
#Preview("Day Complete", as: .systemSmall) {
    SuhoorIftarWidget()
} timeline: {
    SuhoorIftarEntry(
        date: Date(),
        phase: .afterIftar(ramadanDay: 15),
        isRamadan: true,
        ramadanDay: 15
    )
}

@available(iOS 17.0, *)
#Preview("Outside Ramadan", as: .systemSmall) {
    SuhoorIftarWidget()
} timeline: {
    SuhoorIftarEntry(
        date: Date(),
        phase: .outsideRamadan,
        isRamadan: false,
        ramadanDay: 0
    )
}
#endif
