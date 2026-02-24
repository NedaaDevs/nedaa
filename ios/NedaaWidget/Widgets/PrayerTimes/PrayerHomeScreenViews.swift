import SwiftUI
import WidgetKit

// MARK: - Date Extensions

extension Date {
    /// Automatic locale-aware Hijri date with weekday (uses device language)
    func hijriDateString(timezone: TimeZone = .current) -> String {
        var calendar = Calendar(identifier: .islamicUmmAlQura)
        calendar.timeZone = timezone
        calendar.locale = Locale.current

        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale.current
        formatter.timeZone = timezone
        formatter.dateFormat = "EEEE، d MMMM yyyy"

        return formatter.string(from: self)
    }

    /// Compact Hijri date without weekday (for small widgets)
    func hijriDateStringCompact(timezone: TimeZone = .current) -> String {
        var calendar = Calendar(identifier: .islamicUmmAlQura)
        calendar.timeZone = timezone
        calendar.locale = Locale.current

        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale.current
        formatter.timeZone = timezone
        formatter.dateFormat = "d MMMM yyyy"

        return formatter.string(from: self)
    }

    /// Always returns Arabic Hijri date with weekday
    func hijriDateStringArabic(timezone: TimeZone = .current) -> String {
        var calendar = Calendar(identifier: .islamicUmmAlQura)
        calendar.timeZone = timezone
        calendar.locale = Locale(identifier: "ar")

        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "ar")
        formatter.timeZone = timezone
        formatter.dateFormat = "EEEE، d MMMM yyyy"

        return formatter.string(from: self)
    }

    /// Always returns English Hijri date with weekday
    func hijriDateStringEnglish(timezone: TimeZone = .current) -> String {
        var calendar = Calendar(identifier: .islamicUmmAlQura)
        calendar.timeZone = timezone
        calendar.locale = Locale(identifier: "en")

        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en")
        formatter.timeZone = timezone
        formatter.dateFormat = "EEEE, d MMMM yyyy"

        return formatter.string(from: self)
    }
    
    /// Compact time format without AM/PM to avoid ellipsis in Arabic
    func compactTimeString(timezone: TimeZone = .current) -> String {
        let formatter = DateFormatter()
        formatter.timeZone = timezone
        formatter.locale = Locale.current
        // Use 24-hour format or very short time format
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        
        return formatter.string(from: self)
    }
}

// MARK: - Background View

struct WidgetBackgroundView: View {
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

// MARK: - Prayer Time Text Helper
/// Helper view to display prayer time without ellipsis in Arabic
struct PrayerTimeText: View {
    let date: Date
    let font: Font
    let color: Color
    
    var body: some View {
        Text(date, style: .time)
            .font(font)
            .foregroundStyle(color)
            .fixedSize(horizontal: true, vertical: false)
            .minimumScaleFactor(0.7)
    }
}

// MARK: - Small Widget View
struct SmallPrayerTimesView: View {
    let entry: PrayerHomeScreenEntry
    @Environment(\.colorScheme) var colorScheme
    @Environment(\.showsBackground) var showsBackground

    private var timerPhase: PrayerTimelineUtils.TimerPhase {
        PrayerTimelineUtils.timerPhase(
            at: entry.date,
            previousPrayer: entry.previousPrayer,
            nextPrayer: entry.nextPrayer,
            timerEnabled: entry.showTimer
        )
    }

    var body: some View {
        VStack(spacing: 4) {
            headerIcon
                .padding(.top, 4)

            Spacer(minLength: 0)

            mainContent

            Spacer(minLength: 0)

            Text(entry.date.hijriDateStringCompact())
                .font(WidgetTypography.smallHijri)
                .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                .lineLimit(1)
                .padding(.bottom, 4)
        }
        .padding(.horizontal, 12)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var headerIcon: some View {
        let iconName: String = {
            switch timerPhase {
            case .countUp(let prayer):
                return WidgetIcons.prayerIcon(for: prayer.name)
            case .countdown(let prayer), .absoluteTime(let prayer):
                return WidgetIcons.prayerIcon(for: prayer.name)
            case .none:
                return "moon.stars.fill"
            }
        }()

        Image(systemName: iconName)
            .font(.system(size: showsBackground ? 16 : 20))
            .foregroundStyle(NedaaColors.primary(for: colorScheme))
            .accentableWidget()
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var mainContent: some View {
        switch timerPhase {
        case .countUp(let prayer):
            VStack(spacing: 2) {
                Text(LocalizedStringKey(prayer.name))
                    .font(showsBackground ? WidgetTypography.standByPrayerName : WidgetTypography.smallPrayerName)
                    .foregroundStyle(NedaaColors.completed(for: colorScheme))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                Text(prayer.date, style: .timer)
                    .font(showsBackground ? WidgetTypography.standByTimer : WidgetTypography.smallTimer)
                    .foregroundStyle(NedaaColors.completed(for: colorScheme).opacity(0.8))
                    .monospacedDigit()
                    .numericContentTransition()

                if let next = entry.nextPrayer {
                    HStack(spacing: 4) {
                        Text(LocalizedStringKey(next.name))
                        Text(next.date, style: .time)
                    }
                    .font(WidgetTypography.smallCaption)
                    .foregroundStyle(NedaaColors.textSecondary(for: colorScheme).opacity(0.6))
                }
            }

        case .countdown(let prayer):
            VStack(spacing: 2) {
                Text(LocalizedStringKey(prayer.name))
                    .font(showsBackground ? WidgetTypography.standByPrayerName : WidgetTypography.smallPrayerName)
                    .foregroundStyle(NedaaColors.primary(for: colorScheme))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .accentableWidget()

                Text(prayer.date, style: .timer)
                    .font(showsBackground ? WidgetTypography.standByTimer : WidgetTypography.smallTimer)
                    .foregroundStyle(NedaaColors.text(for: colorScheme))
                    .monospacedDigit()
                    .numericContentTransition()

                Text(prayer.date, style: .time)
                    .font(WidgetTypography.smallCaption)
                    .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
            }

        case .absoluteTime(let prayer):
            VStack(spacing: 4) {
                Text(LocalizedStringKey(prayer.name))
                    .font(showsBackground ? WidgetTypography.standByPrayerName : WidgetTypography.smallPrayerName)
                    .foregroundStyle(NedaaColors.primary(for: colorScheme))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .accentableWidget()

                Text(prayer.date, style: .time)
                    .font(showsBackground ? WidgetTypography.standByTime : WidgetTypography.smallTime)
                    .foregroundStyle(NedaaColors.text(for: colorScheme))

                Text(prayer.date, style: .relative)
                    .font(WidgetTypography.smallCaption)
                    .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
            }

        case .none:
            Text("widget.noPrayerTimes")
                .font(.caption)
                .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
        }
    }
}

// MARK: - Large Widget View
struct LargePrayerTimesView: View {
    let entry: PrayerHomeScreenEntry
    @Environment(\.colorScheme) var colorScheme
    @Environment(\.showsBackground) var showsBackground

    var body: some View {
        VStack(spacing: 8) {
            // Header
            HStack {
                Image(systemName: "moon.stars.fill")
                    .font(.title3)
                    .foregroundStyle(NedaaColors.primary(for: colorScheme))

                VStack(alignment: .leading, spacing: 2) {
                    Text("widget.prayerTimes")
                        .font(WidgetTypography.largeHeader)
                        .foregroundStyle(NedaaColors.text(for: colorScheme))

                    HStack(spacing: 4) {
                        Text(entry.date, style: .date)
                            .font(WidgetTypography.largeSubheader)
                            .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))

                        Text("•")
                            .font(WidgetTypography.largeSubheader)
                            .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))

                        Text(entry.date.hijriDateString())
                            .font(WidgetTypography.largeSubheader)
                            .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                            .lineLimit(1)
                    }
                }

                Spacer()
            }

            Divider()
                .background(NedaaColors.textSecondary(for: colorScheme).opacity(0.3))

            // All Prayers List
            VStack(spacing: 4) {
                ForEach(entry.allPrayers) { prayer in
                    PrayerRowView(
                        prayer: prayer,
                        isNext: prayer.isSame(as: entry.nextPrayer),
                        isPast: prayer.isPast(at: entry.date),
                        entryDate: entry.date,
                        showTimer: entry.showTimer,
                        colorScheme: colorScheme
                    )
                }
            }

            Spacer(minLength: 0)

            // Day progress bar
            DayProgressBar(
                allPrayers: entry.allPrayers,
                entryDate: entry.date,
                colorScheme: colorScheme
            )
            .padding(.bottom, 4)
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 10)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Supporting Views

private struct DayProgressBar: View {
    let allPrayers: [PrayerData]
    let entryDate: Date
    let colorScheme: ColorScheme

    private var progress: Double {
        guard let first = allPrayers.first, let last = allPrayers.last else { return 0 }
        let totalDuration = last.date.timeIntervalSince(first.date)
        guard totalDuration > 0 else { return 0 }
        let elapsed = entryDate.timeIntervalSince(first.date)
        return min(max(elapsed / totalDuration, 0), 1)
    }

    var body: some View {
        VStack(spacing: 4) {
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(NedaaColors.textSecondary(for: colorScheme).opacity(0.15))
                        .frame(height: 4)

                    Capsule()
                        .fill(NedaaColors.primary(for: colorScheme))
                        .frame(width: geometry.size.width * progress, height: 4)
                }
            }
            .frame(height: 4)

            HStack {
                if let first = allPrayers.first {
                    Text(LocalizedStringKey(first.name))
                        .font(.system(size: 8))
                        .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                }
                Spacer()
                if let last = allPrayers.last {
                    Text(LocalizedStringKey(last.name))
                        .font(.system(size: 8))
                        .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                }
            }
        }
    }
}

struct PrayerRowView: View {
    let prayer: PrayerData
    let isNext: Bool
    let isPast: Bool
    let entryDate: Date
    let showTimer: Bool
    let colorScheme: ColorScheme
    @Environment(\.showsBackground) var showsBackground

    private var minutesToPrayer: Int {
        Calendar.current.dateComponents([.minute], from: entryDate, to: prayer.date).minute ?? 0
    }

    private var showCountdown: Bool {
        isNext && minutesToPrayer > 0 && minutesToPrayer <= 60 && showTimer
    }

    var body: some View {
        HStack(spacing: 8) {
            // Status indicator
            statusIcon

            // Prayer name
            Text(LocalizedStringKey(prayer.name))
                .font(isNext ? WidgetTypography.largePrayerNameActive : WidgetTypography.largePrayerName)
                .foregroundStyle(nameColor)
                .accentableWidget(isNext)

            Spacer()

            // Time or countdown
            if showCountdown {
                Text(prayer.date, style: .timer)
                    .font(WidgetTypography.largeTimer)
                    .foregroundStyle(NedaaColors.text(for: colorScheme))
                    .numericContentTransition()
            } else {
                Text(prayer.date, format: .dateTime.hour().minute())
                    .font(WidgetTypography.largeTime)
                    .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                    .monospacedDigit()
            }
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 10)
        .background(rowBackground)
        .clipShape(.rect(cornerRadius: 8))
    }

    @ViewBuilder
    private var statusIcon: some View {
        if isNext {
            Circle()
                .fill(NedaaColors.primary(for: colorScheme))
                .frame(width: 8, height: 8)
        } else if isPast {
            Image(systemName: "checkmark")
                .font(.system(size: 7, weight: .bold))
                .foregroundStyle(NedaaColors.completed(for: colorScheme).opacity(0.6))
        } else {
            Circle()
                .stroke(NedaaColors.textSecondary(for: colorScheme).opacity(0.3), lineWidth: 1)
                .frame(width: 8, height: 8)
        }
    }

    private var nameColor: Color {
        if isNext {
            return NedaaColors.primary(for: colorScheme)
        } else if isPast {
            return NedaaColors.textSecondary(for: colorScheme)
        } else {
            return NedaaColors.text(for: colorScheme)
        }
    }

    private var rowBackground: Color {
        guard showsBackground else { return Color.clear }
        if isNext {
            return NedaaColors.primary(for: colorScheme).opacity(0.1)
        }
        return Color.clear
    }
}

// MARK: - Medium Widget List View
struct MediumPrayerTimesListView: View {
    let entry: PrayerHomeScreenEntry
    @Environment(\.colorScheme) var colorScheme
    @Environment(\.showsBackground) var showsBackground

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Hijri date header
            HStack {
                Image(systemName: "moon.stars.fill")
                    .font(.system(size: 9))
                    .foregroundStyle(NedaaColors.primary(for: colorScheme))

                Text(entry.date.hijriDateString())
                    .font(WidgetTypography.mediumHijri)
                    .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                    .lineLimit(1)

                Spacer()

                Text(entry.date, style: .date)
                    .font(WidgetTypography.mediumDate)
                    .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
            }
            .padding(.horizontal, 10)
            .padding(.top, 4)
            .padding(.bottom, 3)

            // Prayer list
            VStack(alignment: .leading, spacing: 1) {
                ForEach(entry.allPrayers) { prayer in
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

                    HStack(spacing: 6) {
                        // Status indicator
                        statusIcon(isNext: isNext, isPast: isPast, isPreviousActive: isPreviousActive)

                        // Prayer name
                        Text(LocalizedStringKey(prayer.name))
                            .font(isNext ? WidgetTypography.mediumPrayerNameActive : WidgetTypography.mediumPrayerName)
                            .foregroundStyle(prayerNameColor(isNext: isNext, isPast: isPast))
                            .lineLimit(1)
                            .accentableWidget(isNext)

                        Spacer()

                        // Time or timer
                        if isPreviousActive {
                            Text(prayer.date, style: .timer)
                                .font(WidgetTypography.mediumTimer)
                                .foregroundStyle(NedaaColors.completed(for: colorScheme))
                                .monospacedDigit()
                                .numericContentTransition()
                        } else if showCountdown {
                            Text(prayer.date, style: .timer)
                                .font(WidgetTypography.mediumTimer)
                                .foregroundStyle(NedaaColors.text(for: colorScheme))
                                .monospacedDigit()
                                .numericContentTransition()
                        } else {
                            Text(prayer.date, format: .dateTime.hour().minute())
                                .font(WidgetTypography.mediumTime)
                                .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                                .monospacedDigit()
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 3)
                    .background(rowBackground(isNext: isNext, isPreviousActive: isPreviousActive))
                    .clipShape(.rect(cornerRadius: 6))
                }
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 4)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Helpers

    @ViewBuilder
    private func statusIcon(isNext: Bool, isPast: Bool, isPreviousActive: Bool) -> some View {
        if isPreviousActive {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 8))
                .foregroundStyle(NedaaColors.completed(for: colorScheme))
        } else if isNext {
            Circle()
                .fill(NedaaColors.primary(for: colorScheme))
                .frame(width: 7, height: 7)
        } else if isPast {
            Image(systemName: "checkmark")
                .font(.system(size: 7, weight: .bold))
                .foregroundStyle(NedaaColors.completed(for: colorScheme).opacity(0.6))
        } else {
            Circle()
                .stroke(NedaaColors.textSecondary(for: colorScheme).opacity(0.3), lineWidth: 1)
                .frame(width: 7, height: 7)
        }
    }

    private func prayerNameColor(isNext: Bool, isPast: Bool) -> Color {
        if isNext {
            return NedaaColors.primary(for: colorScheme)
        } else if isPast {
            return NedaaColors.textSecondary(for: colorScheme)
        } else {
            return NedaaColors.text(for: colorScheme).opacity(0.8)
        }
    }

    private func rowBackground(isNext: Bool, isPreviousActive: Bool) -> Color {
        guard showsBackground else { return Color.clear }
        if isNext {
            return NedaaColors.primary(for: colorScheme).opacity(0.12)
        } else if isPreviousActive {
            return NedaaColors.completed(for: colorScheme).opacity(0.08)
        }
        return Color.clear
    }
}

// MARK: - Previews
#if swift(>=5.9)
    @available(iOS 17.0, *)
    #Preview("Small", as: .systemSmall) {
        PrayerTimesHomeScreen()
    } timeline: {
        PrayerHomeScreenEntry.preview
    }

    @available(iOS 17.0, *)
    #Preview("Medium", as: .systemMedium) {
        PrayerTimesHomeScreen()
    } timeline: {
        PrayerHomeScreenEntry.preview
    }

    @available(iOS 17.0, *)
    #Preview("Large", as: .systemLarge) {
        PrayerTimesHomeScreen()
    } timeline: {
        PrayerHomeScreenEntry.preview
    }
#endif
