import SwiftUI
import WidgetKit

// MARK: - Timeline Entry

struct ImportantDaysEntry: TimelineEntry {
    let date: Date
    let days: [ImportantDayItem]

    /// Upcoming occasions relative to this entry's date, soonest first.
    var upcoming: [(item: ImportantDayItem, remaining: Int)] {
        days.compactMap { item in
            guard let remaining = ImportantDaysDataService.daysUntil(item.dateISO, from: date),
                  remaining >= 0 else { return nil }
            return (item, remaining)
        }
        .sorted { $0.remaining < $1.remaining }
    }

    var relevance: TimelineEntryRelevance? {
        if let soonest = upcoming.first, soonest.remaining <= 1 {
            return TimelineEntryRelevance(score: 1.0, duration: 86400)
        }
        return TimelineEntryRelevance(score: 0.25, duration: 86400)
    }

    static var preview: ImportantDaysEntry {
        ImportantDaysEntry(
            date: Date(),
            days: [
                ImportantDayItem(id: "ramadan", dateISO: "2026-08-14", sort: 0),
                ImportantDayItem(id: "eid-al-fitr", dateISO: "2026-09-13", sort: 1),
                ImportantDayItem(id: "arafah", dateISO: "2026-11-19", sort: 2),
            ]
        )
    }
}

// MARK: - Localization helpers (device language, like the other widgets)

/// Localized occasion name from its id, e.g. "ramadan" -> "Ramadan" / "رمضان".
private func occasionName(_ id: String) -> String {
    NSLocalizedString("occasion.\(id)", comment: "")
}

/// The occasion's Hijri date formatted in the device language, e.g.
/// "1 Ramadan 1448" / "١ رمضان ١٤٤٨".
private func hijriLabel(_ dateISO: String) -> String {
    guard let date = ImportantDaysDataService.date(fromISO: dateISO) else { return "" }
    return date.hijriDateStringCompact()
}

// MARK: - Timeline Provider

struct ImportantDaysProvider: TimelineProvider {
    private let dataService = ImportantDaysDataService()

    func placeholder(in context: Context) -> ImportantDaysEntry {
        .preview
    }

    func getSnapshot(in context: Context, completion: @escaping (ImportantDaysEntry) -> Void) {
        completion(ImportantDaysEntry(date: Date(), days: dataService.getUpcomingImportantDays()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ImportantDaysEntry>) -> Void) {
        let now = Date()
        let days = dataService.getUpcomingImportantDays()

        // Refresh at the next midnight (count ticks down) and on each occasion
        // date (soonest occasion rolls off). .atEnd asks for a fresh timeline.
        var dates: Set<Date> = [now]
        let calendar = Calendar.current
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now) {
            dates.insert(calendar.startOfDay(for: tomorrow))
        }
        for day in days {
            if let target = ImportantDaysDataService.date(fromISO: day.dateISO), target > now {
                dates.insert(calendar.startOfDay(for: target))
            }
        }

        let entries = dates.sorted().map { ImportantDaysEntry(date: $0, days: days) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

// MARK: - Views

@available(iOSApplicationExtension 17.0, *)
struct ImportantDaysWidgetView: View {
    let entry: ImportantDaysEntry
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        Group {
            if entry.upcoming.isEmpty {
                placeholderView
            } else if family == .systemMedium {
                mediumView
            } else {
                smallView
            }
        }
        .widgetURL(URL(string: "myapp:///"))
    }

    // MARK: Small — soonest occasion with a large day count

    private var smallView: some View {
        let next = entry.upcoming[0]
        return VStack(spacing: 4) {
            Image(systemName: "calendar")
                .font(.system(size: 16))
                .foregroundStyle(NedaaColors.primary(for: colorScheme))
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 4)

            Spacer(minLength: 0)

            VStack(spacing: 2) {
                Text(occasionName(next.item.id))
                    .font(WidgetTypography.smallPrayerName)
                    .foregroundStyle(NedaaColors.primary(for: colorScheme))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)

                countView(remaining: next.remaining)

                Text(hijriLabel(next.item.dateISO))
                    .font(WidgetTypography.smallCaption)
                    .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .accessibilityElement(children: .combine)
    }

    /// Big number + "days" unit, or the word "Today" when it's the day itself.
    @ViewBuilder
    private func countView(remaining: Int) -> some View {
        if remaining == 0 {
            Text("widget_days_today")
                .font(WidgetTypography.smallTimer)
                .foregroundStyle(NedaaColors.text(for: colorScheme))
        } else {
            VStack(spacing: -2) {
                Text(remaining, format: .number)
                    .font(WidgetTypography.smallTimer)
                    .foregroundStyle(NedaaColors.text(for: colorScheme))
                Text("widget_days_unit")
                    .font(WidgetTypography.smallCaption)
                    .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
            }
        }
    }

    // MARK: Medium — header + up to three upcoming occasions

    private var mediumView: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "calendar")
                    .font(.system(size: 13))
                    .foregroundStyle(NedaaColors.primary(for: colorScheme))
                Text("importantDaysWidgetTitle")
                    .font(WidgetTypography.largeHeader)
                    .foregroundStyle(NedaaColors.text(for: colorScheme))
            }

            Divider()

            ForEach(Array(entry.upcoming.prefix(3).enumerated()), id: \.offset) { _, row in
                occasionRow(item: row.item, remaining: row.remaining)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private func occasionRow(item: ImportantDayItem, remaining: Int) -> some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 1) {
                Text(occasionName(item.id))
                    .font(WidgetTypography.mediumPrayerNameActive)
                    .foregroundStyle(NedaaColors.text(for: colorScheme))
                    .lineLimit(1)
                Text(hijriLabel(item.dateISO))
                    .font(WidgetTypography.mediumDate)
                    .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            remainingLabel(remaining)
                .font(WidgetTypography.mediumPrayerNameActive)
                .foregroundStyle(NedaaColors.primary(for: colorScheme))
                .lineLimit(1)
        }
    }

    private func remainingLabel(_ remaining: Int) -> Text {
        if remaining == 0 {
            return Text("widget_days_today")
        }
        // "220 days" — number localized via the environment locale.
        return Text(remaining, format: .number) + Text(" ") + Text("widget_days_unit")
    }

    // MARK: Placeholder (no synced data yet)

    private var placeholderView: some View {
        VStack(spacing: 6) {
            Image(systemName: "calendar")
                .font(.system(size: 18))
                .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
            Text("importantDaysWidgetTitle")
                .font(WidgetTypography.smallPrayerName)
                .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.7)
        }
        .padding(.horizontal, 12)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Widget Definition

@available(iOSApplicationExtension 17.0, *)
struct ImportantDaysWidget: Widget {
    let kind: String = "ImportantDaysWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ImportantDaysProvider()) { entry in
            ImportantDaysWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    WidgetBackgroundView()
                }
        }
        .configurationDisplayName(NSLocalizedString("importantDaysWidgetTitle", comment: ""))
        .description(NSLocalizedString("importantDaysWidgetDesc", comment: ""))
        .supportedFamilies([.systemSmall, .systemMedium])
        .contentMarginsDisabledIfAvailable()
    }
}

// MARK: - Previews

#if swift(>=5.9)
@available(iOS 17.0, *)
#Preview("Small", as: .systemSmall) {
    ImportantDaysWidget()
} timeline: {
    ImportantDaysEntry.preview
}

@available(iOS 17.0, *)
#Preview("Medium", as: .systemMedium) {
    ImportantDaysWidget()
} timeline: {
    ImportantDaysEntry.preview
}
#endif
