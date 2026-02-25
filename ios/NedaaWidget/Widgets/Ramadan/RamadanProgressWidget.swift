import SwiftUI
import WidgetKit
import AppIntents

// MARK: - Widget Configuration Intent

@available(iOS 17.0, *)
struct RamadanProgressConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "widget_ramadan_progress_settings"
    static var description = IntentDescription("widget_ramadan_progress_settings_desc")
}

// MARK: - Milestone Enum

enum RamadanMilestone {
    case suhoor(Date)
    case iftar(Date)

    var date: Date {
        switch self {
        case .suhoor(let date): return date
        case .iftar(let date): return date
        }
    }
}

// MARK: - Timeline Entry

struct RamadanProgressEntry: TimelineEntry {
    let date: Date
    let isRamadan: Bool
    let ramadanDay: Int
    let totalDays: Int
    let iftarTime: Date?
    let imsakTime: Date?
    let tomorrowImsakTime: Date?
    let nextMilestone: RamadanMilestone?

    var relevance: TimelineEntryRelevance? {
        guard isRamadan else { return nil }

        return prayerTimelineRelevance(
            nextPrayerDate: nil,
            previousPrayerDate: nil,
            currentDate: date,
            isRamadan: true,
            imsakDate: imsakTime,
            maghribDate: iftarTime
        )
    }

    static var preview: RamadanProgressEntry {
        let now = Date()
        let calendar = Calendar.current
        let iftarDate = calendar.date(bySettingHour: 18, minute: 15, second: 0, of: now)!
        let imsakDate = calendar.date(bySettingHour: 4, minute: 30, second: 0, of: now)!

        return RamadanProgressEntry(
            date: now,
            isRamadan: true,
            ramadanDay: 15,
            totalDays: 30,
            iftarTime: iftarDate,
            imsakTime: imsakDate,
            tomorrowImsakTime: calendar.date(bySettingHour: 4, minute: 29, second: 0, of: calendar.date(byAdding: .day, value: 1, to: now)!)!,
            nextMilestone: .iftar(iftarDate)
        )
    }

    static var notRamadanPreview: RamadanProgressEntry {
        RamadanProgressEntry(
            date: Date(),
            isRamadan: false,
            ramadanDay: 0,
            totalDays: 30,
            iftarTime: nil,
            imsakTime: nil,
            tomorrowImsakTime: nil,
            nextMilestone: nil
        )
    }
}

// MARK: - Timeline Provider

@available(iOS 17.0, *)
struct RamadanProgressProvider: AppIntentTimelineProvider {
    typealias Entry = RamadanProgressEntry
    typealias Intent = RamadanProgressConfigurationIntent

    private let prayerService = PrayerDataService()

    func placeholder(in context: Context) -> RamadanProgressEntry {
        RamadanProgressEntry.preview
    }

    func snapshot(for configuration: RamadanProgressConfigurationIntent, in context: Context) async -> RamadanProgressEntry {
        createEntry(for: Date())
    }

    func timeline(for configuration: RamadanProgressConfigurationIntent, in context: Context) async -> Timeline<RamadanProgressEntry> {
        let currentDate = Date()
        let isRamadan = PrayerTimelineUtils.isRamadan(currentDate)

        guard isRamadan else {
            let entry = RamadanProgressEntry(
                date: currentDate,
                isRamadan: false,
                ramadanDay: 0,
                totalDays: 30,
                iftarTime: nil,
                imsakTime: nil,
                tomorrowImsakTime: nil,
                nextMilestone: nil
            )
            return Timeline(entries: [entry], policy: .after(currentDate.addingTimeInterval(3600)))
        }

        let todayPrayers = prayerService.getTodaysPrayerTimes(showSunrise: false)

        let imsakTime = prayerService.getImsakTime()?.date
        let maghribTime = todayPrayers?.first(where: { $0.name == "maghrib" })?.date

        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: currentDate)
        let tomorrowImsakTime = tomorrow.flatMap { prayerService.getImsakTime(for: $0)?.date }

        let entryDates = generateRamadanEntryDates(
            from: currentDate,
            imsakTime: imsakTime,
            maghribTime: maghribTime,
            tomorrowImsakTime: tomorrowImsakTime
        )

        var entries: [RamadanProgressEntry] = []
        for entryDate in entryDates {
            let entry = createEntry(for: entryDate, todayPrayers: todayPrayers)
            entries.append(entry)
        }

        return Timeline(entries: entries, policy: .atEnd)
    }

    private func createEntry(
        for date: Date,
        todayPrayers: [PrayerData]? = nil
    ) -> RamadanProgressEntry {
        let isRamadan = PrayerTimelineUtils.isRamadan(date)

        guard isRamadan else {
            return RamadanProgressEntry(
                date: date,
                isRamadan: false,
                ramadanDay: 0,
                totalDays: 30,
                iftarTime: nil,
                imsakTime: nil,
                tomorrowImsakTime: nil,
                nextMilestone: nil
            )
        }

        let ramadanDay = PrayerTimelineUtils.ramadanDay(date)
        let prayers = todayPrayers ?? prayerService.getTodaysPrayerTimes(showSunrise: false)
        let imsakTime = prayerService.getImsakTime()?.date
        let maghribTime = prayers?.first(where: { $0.name == "maghrib" })?.date

        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: date)
        let tomorrowImsakTime = tomorrow.flatMap { prayerService.getImsakTime(for: $0)?.date }

        let nextMilestone = resolveNextMilestone(
            at: date,
            imsakTime: imsakTime,
            maghribTime: maghribTime,
            tomorrowImsakTime: tomorrowImsakTime
        )

        return RamadanProgressEntry(
            date: date,
            isRamadan: true,
            ramadanDay: ramadanDay,
            totalDays: 30,
            iftarTime: maghribTime,
            imsakTime: imsakTime,
            tomorrowImsakTime: tomorrowImsakTime,
            nextMilestone: nextMilestone
        )
    }

    private func resolveNextMilestone(
        at date: Date,
        imsakTime: Date?,
        maghribTime: Date?,
        tomorrowImsakTime: Date?
    ) -> RamadanMilestone? {
        if let imsak = imsakTime, imsak > date {
            return .suhoor(imsak)
        }

        if let maghrib = maghribTime, maghrib > date {
            return .iftar(maghrib)
        }

        if let tomorrowImsak = tomorrowImsakTime, tomorrowImsak > date {
            return .suhoor(tomorrowImsak)
        }

        return nil
    }

    private func generateRamadanEntryDates(
        from currentDate: Date,
        imsakTime: Date?,
        maghribTime: Date?,
        tomorrowImsakTime: Date?
    ) -> [Date] {
        var dates: Set<Date> = []

        dates.insert(currentDate)

        if let imsak = imsakTime, imsak > currentDate {
            dates.insert(imsak)
        }

        if let maghrib = maghribTime, maghrib > currentDate {
            dates.insert(maghrib)
            let iftarUrgency = maghrib.addingTimeInterval(-3600)
            if iftarUrgency > currentDate {
                dates.insert(iftarUrgency)
            }
        }

        let startOfTomorrow = Calendar.current.startOfDay(
            for: Calendar.current.date(byAdding: .day, value: 1, to: currentDate) ?? currentDate
        )
        dates.insert(startOfTomorrow)

        if let tomorrowImsak = tomorrowImsakTime {
            let suhoorUrgency = tomorrowImsak.addingTimeInterval(-2700)
            if suhoorUrgency > currentDate {
                dates.insert(suhoorUrgency)
            }
        }

        return dates
            .filter { $0 >= currentDate }
            .sorted()
    }
}

// MARK: - Progress Bar View

@available(iOSApplicationExtension 17.0, *)
struct RamadanProgressBar: View {
    let current: Int
    let total: Int
    let accentColor: Color

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.gray.opacity(0.2))

                RoundedRectangle(cornerRadius: 4)
                    .fill(accentColor)
                    .frame(width: geometry.size.width * CGFloat(current) / CGFloat(max(total, 1)))
            }
        }
        .frame(height: 8)
    }
}

// MARK: - Background View

@available(iOSApplicationExtension 17.0, *)
struct RamadanWidgetBackgroundView: View {
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        LinearGradient(
            gradient: Gradient(colors: [
                NedaaColors.ramadanAccent(for: colorScheme).opacity(0.15),
                NedaaColors.ramadanAccent(for: colorScheme).opacity(0.05),
            ]),
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

// MARK: - Widget View

@available(iOSApplicationExtension 17.0, *)
struct RamadanProgressWidgetView: View {
    let entry: RamadanProgressEntry
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        Group {
            if entry.isRamadan {
                ramadanActiveView
            } else {
                ramadanInactiveView
            }
        }
        .widgetURL(URL(string: "myapp:///"))
    }

    // MARK: - Active Ramadan View

    private var ramadanActiveView: some View {
        VStack(alignment: .leading, spacing: 10) {
            headerRow

            progressRow

            Spacer(minLength: 4)

            timesSection
        }
        .padding(16)
        .accessibilityElement(children: .combine)
    }

    private var headerRow: some View {
        HStack {
            Image(systemName: "moon.stars.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(NedaaColors.ramadanAccent(for: colorScheme))

            Text(NSLocalizedString("ramadan", comment: ""))
                .font(WidgetTypography.mediumPrayerNameActive)
                .foregroundStyle(NedaaColors.text(for: colorScheme))

            Spacer()

            Text(entry.date.hijriDateStringCompact())
                .font(WidgetTypography.mediumPrayerName)
                .foregroundStyle(NedaaColors.ramadanAccent(for: colorScheme))
                .lineLimit(1)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(
                    NedaaColors.ramadanAccent(for: colorScheme).opacity(0.15)
                )
                .clipShape(.rect(cornerRadius: 6))
        }
    }

    private var progressRow: some View {
        HStack(spacing: 8) {
            RamadanProgressBar(
                current: entry.ramadanDay,
                total: entry.totalDays,
                accentColor: NedaaColors.ramadanAccent(for: colorScheme)
            )

            Text("\(entry.ramadanDay)/\(entry.totalDays)")
                .font(WidgetTypography.mediumTime)
                .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                .fixedSize(horizontal: true, vertical: false)
        }
    }

    private var timesSection: some View {
        VStack(spacing: 6) {
            timeRow(
                icon: "moon.haze.fill",
                label: NSLocalizedString("suhoor", comment: ""),
                time: entry.imsakTime ?? entry.tomorrowImsakTime,
                milestone: suhoorMilestone
            )

            timeRow(
                icon: "sunset.fill",
                label: NSLocalizedString("iftar", comment: ""),
                time: entry.iftarTime,
                milestone: iftarMilestone
            )
        }
    }

    private func timeRow(icon: String, label: String, time: Date?, milestone: RamadanMilestone?) -> some View {
        HStack {
            Image(systemName: icon)
                .font(.system(size: 12))
                .foregroundStyle(NedaaColors.ramadanAccent(for: colorScheme))
                .frame(width: 16)

            Text(label)
                .font(WidgetTypography.mediumPrayerName)
                .foregroundStyle(NedaaColors.text(for: colorScheme))

            Spacer()

            if let time = time {
                PrayerTimeText(
                    date: time,
                    font: WidgetTypography.mediumTime,
                    color: NedaaColors.textSecondary(for: colorScheme)
                )
            }

            if let milestone = milestone, isWithinCountdownWindow(milestone) {
                countdownView(for: milestone)
            }
        }
    }

    private var suhoorMilestone: RamadanMilestone? {
        guard let milestone = entry.nextMilestone else { return nil }
        if case .suhoor = milestone { return milestone }
        return nil
    }

    private var iftarMilestone: RamadanMilestone? {
        guard let milestone = entry.nextMilestone else { return nil }
        if case .iftar = milestone { return milestone }
        return nil
    }

    private func isWithinCountdownWindow(_ milestone: RamadanMilestone) -> Bool {
        let remaining = milestone.date.timeIntervalSince(entry.date)
        return remaining > 0 && remaining <= 3600
    }

    private func countdownView(for milestone: RamadanMilestone) -> some View {
        HStack(spacing: 2) {
            Image(systemName: "arrow.right")
                .font(.system(size: 8, weight: .semibold))

            Text(milestone.date, style: .timer)
                .font(WidgetTypography.mediumTimer)
                .monospacedDigit()
                .numericContentTransition()
        }
        .foregroundStyle(NedaaColors.ramadanAccent(for: colorScheme))
    }

    // MARK: - Inactive Ramadan View

    private var ramadanInactiveView: some View {
        VStack(spacing: 12) {
            Image(systemName: "moon.stars.fill")
                .font(.system(size: 30))
                .foregroundStyle(NedaaColors.textSecondary(for: colorScheme).opacity(0.5))

            Text(NSLocalizedString("ramadan", comment: ""))
                .font(WidgetTypography.mediumPrayerNameActive)
                .foregroundStyle(NedaaColors.text(for: colorScheme))

            Text(NSLocalizedString("widget_ramadan_placeholder", comment: ""))
                .font(WidgetTypography.mediumTime)
                .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(16)
    }
}

// MARK: - Widget Definition

@available(iOSApplicationExtension 17.0, *)
struct RamadanProgressWidget: Widget {
    let kind: String = "RamadanProgressWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: RamadanProgressConfigurationIntent.self,
            provider: RamadanProgressProvider()
        ) { entry in
            RamadanProgressWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    RamadanWidgetBackgroundView()
                }
        }
        .configurationDisplayName(NSLocalizedString("ramadanProgressWidgetTitle", comment: ""))
        .description(NSLocalizedString("ramadanProgressWidgetDesc", comment: ""))
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabledIfAvailable()
    }
}

// MARK: - Previews

#if swift(>=5.9)
@available(iOS 17.0, *)
#Preview(as: .systemMedium) {
    RamadanProgressWidget()
} timeline: {
    RamadanProgressEntry.preview
    RamadanProgressEntry.notRamadanPreview
}
#endif
