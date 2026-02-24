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

// MARK: - Medium Widget View
struct MediumPrayerTimesView: View {
    let entry: PrayerHomeScreenEntry
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        VStack(spacing: 2) {
            // Hijri date header
            HStack(spacing: 4) {
                Image(systemName: "moon.stars.fill")
                    .font(.system(size: 8))
                    .foregroundStyle(NedaaColors.primary(for: colorScheme))

                Text(entry.date.hijriDateString())
                    .font(.system(size: 8))
                    .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)

                Spacer()

                Text(entry.date, style: .date)
                    .font(.system(size: 8))
                    .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
            }
            .padding(.horizontal, 10)
            .padding(.top, 3)
            .padding(.bottom, 1)

            // Prayer times
            HStack(spacing: entry.allPrayers.count > 5 ? 0 : 2) {
                ForEach(entry.allPrayers) { prayer in
                    VStack(spacing: 2) {
                        Text(LocalizedStringKey(prayer.name))
                            .font(.system(size: entry.allPrayers.count > 5 ? 9 : 10.5))
                            .fontWeight(.semibold)
                            .minimumScaleFactor(0.4)
                            .lineLimit(1)
                            .foregroundStyle(NedaaColors.text(for: colorScheme))

                        PrayerTimeText(
                            date: prayer.date,
                            font: .system(size: entry.allPrayers.count > 5 ? 8 : 9),
                            color: NedaaColors.textSecondary(for: colorScheme)
                        )

                        // Progress dot
                        Circle()
                            .fill(dotColor(for: prayer))
                            .frame(width: 5, height: 5)
                            .padding(.top, 1)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, entry.allPrayers.count > 5 ? 1 : 2)
                }
            }
            .padding(.horizontal, 6)
            .padding(.bottom, 6)
        }
        .accessibilityElement(children: .combine)
    }

    private func dotColor(for prayer: PrayerData) -> Color {
        if isNextPrayer(prayer) {
            return NedaaColors.primary(for: colorScheme)
        } else if prayer.isPast {
            return NedaaColors.success
        } else {
            return NedaaColors.textSecondary(for: colorScheme).opacity(0.3)
        }
    }

    private func isNextPrayer(_ prayer: PrayerData) -> Bool {
        return prayer.isSame(as: entry.nextPrayer)
    }
}

// MARK: - Large Widget View
struct LargePrayerTimesView: View {
    let entry: PrayerHomeScreenEntry
    @Environment(\.colorScheme) var colorScheme
    @Environment(\.showsBackground) var showsBackground

    var body: some View {
        VStack(spacing: 12) {
            // Header
            HStack {
                Image(systemName: "moon.stars.fill")
                    .font(.title3)
                    .foregroundStyle(NedaaColors.primary(for: colorScheme))

                VStack(alignment: .leading, spacing: 2) {
                    Text("widget.prayerTimes")
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .foregroundStyle(NedaaColors.text(for: colorScheme))

                    HStack(spacing: 4) {
                        Text(entry.date, style: .date)
                            .font(.caption2)
                            .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))

                        Text("•")
                            .font(.caption2)
                            .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))

                        Text(entry.date.hijriDateString())
                            .font(.caption2)
                            .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                    }
                }

                Spacer()
            }

            Divider()
                .background(NedaaColors.textSecondary(for: colorScheme).opacity(0.3))

            // All Prayers List
            VStack(spacing: 8) {
                ForEach(entry.allPrayers) { prayer in
                    PrayerRowView(
                        prayer: prayer,
                        isPrevious: isPreviousPrayer(prayer),
                        isNext: isNextPrayer(prayer),
                        colorScheme: colorScheme
                    )
                }
            }

            Spacer(minLength: 0)

            // Footer - Next Prayer Countdown
            if let nextPrayer = entry.nextPrayer, nextPrayer.date > entry.date {
                HStack(spacing: 6) {
                    Image(systemName: "clock.fill")
                        .foregroundStyle(NedaaColors.primary(for: colorScheme))
                        .font(.caption)

                    Text("widget.nextPrayerIn")
                        .font(.caption)
                        .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))

                    Text(nextPrayer.date, style: .relative)
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(NedaaColors.text(for: colorScheme))
                        .numericContentTransition()
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(showsBackground ? NedaaColors.primary(for: colorScheme).opacity(0.15) : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .padding(.bottom, 4)
                .accentableWidget()
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 12)
        .accessibilityElement(children: .combine)
    }

    private func isPreviousPrayer(_ prayer: PrayerData) -> Bool {
        return prayer.isSame(as: entry.previousPrayer)
    }

    private func isNextPrayer(_ prayer: PrayerData) -> Bool {
        return prayer.isSame(as: entry.nextPrayer)
    }
}

// MARK: - Supporting Views
struct PrayerRowView: View {
    let prayer: PrayerData
    let isPrevious: Bool
    let isNext: Bool
    let colorScheme: ColorScheme
    @Environment(\.showsBackground) var showsBackground

    var body: some View {
        HStack(spacing: 8) {
            // Status dot
            Circle()
                .fill(dotColor)
                .frame(width: 8, height: 8)

            // Prayer name
            Text(LocalizedStringKey(prayer.name))
                .font(.caption)
                .fontWeight(isNext || isPrevious ? .semibold : .regular)
                .foregroundStyle(NedaaColors.text(for: colorScheme))

            Spacer()

            // Time
            PrayerTimeText(
                date: prayer.date,
                font: .caption2,
                color: NedaaColors.textSecondary(for: colorScheme)
            )

            // Label
            if isPrevious {
                Text("widget.previous")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundStyle(NedaaColors.success)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(NedaaColors.success.opacity(0.2))
                    .clipShape(Capsule())
            } else if isNext {
                Text("widget.next")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundStyle(NedaaColors.primary(for: colorScheme))
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(NedaaColors.primary(for: colorScheme).opacity(0.2))
                    .clipShape(Capsule())
            }
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 10)
        .background(rowBackground)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var dotColor: Color {
        if isNext {
            return NedaaColors.primary(for: colorScheme)
        } else if prayer.isPast {
            return NedaaColors.success
        } else {
            return NedaaColors.textSecondary(for: colorScheme).opacity(0.3)
        }
    }

    private var rowBackground: Color {
        guard showsBackground else { return Color.clear }
        if isNext {
            return NedaaColors.primary(for: colorScheme).opacity(0.1)
        } else if isPrevious {
            return NedaaColors.success.opacity(0.05)
        } else {
            return Color.clear
        }
    }
}

// MARK: - Medium Widget List View
struct MediumPrayerTimesListView: View {
    let entry: PrayerHomeScreenEntry
    @Environment(\.colorScheme) var colorScheme
    @Environment(\.showsBackground) var showsBackground

    var body: some View {
        GeometryReader { geometry in
            let totalPadding = CGFloat(entry.allPrayers.count - 1) * 0.5
            let topBottomPadding: CGFloat = 15  // Space for Hijri date header
            let availableHeight = geometry.size.height - totalPadding - topBottomPadding
            
            let baseHeight = availableHeight / (CGFloat(entry.allPrayers.count) + 0.5)
            let activeHeight = baseHeight * 1.5

            VStack(alignment: .leading, spacing: 0) {
                // Hijri date header
                HStack {
                    Image(systemName: "moon.stars.fill")
                        .font(.system(size: 9))
                        .foregroundStyle(NedaaColors.primary(for: colorScheme))

                    Text(entry.date.hijriDateString())
                        .font(.system(size: 9))
                        .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))

                    Spacer()

                    Text(entry.date, style: .date)
                        .font(.system(size: 9))
                        .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                }
                .padding(.horizontal, 10)
                .padding(.top, 3)
                .padding(.bottom, 2)

                // Prayer list
                VStack(alignment: .leading, spacing: 0.5) {
                    ForEach(entry.allPrayers) { prayer in
                        let isNextPrayer = prayer.isSame(as: entry.nextPrayer)
                        let isPastPrayer = prayer.isPast
                        
                        // Determine if this row is the "Active" one (showing timer)
                        let isTimerActive = (isNextPrayer && shouldShowCountdown(for: prayer) && isTimerEnabled) ||
                                          (isPastPrayer && shouldShowCountUp(for: prayer) && isTimerEnabled)
                        
                        let rowHeight = isTimerActive ? activeHeight : baseHeight

                        HStack {
                            // Prayer name
                            Text(LocalizedStringKey(prayer.name))
                                .font(.system(size: rowHeight * 0.55))
                                .fontWeight(isNextPrayer ? .bold : .medium)
                                .foregroundStyle(
                                    prayerNameColor(isNext: isNextPrayer, isPast: isPastPrayer))
                                .accentableWidget(isNextPrayer)

                            Spacer()

                            // Prayer time with conditional timer
                            makePrayerTimeText(
                                prayer: prayer,
                                isNext: isNextPrayer,
                                isPast: isPastPrayer,
                                fontHeight: rowHeight,
                                isTimerActive: isTimerActive
                            )
                            .multilineTextAlignment(.trailing)
                        }
                        .frame(height: rowHeight) // Enforce calculated height
                        .padding(.horizontal, 10)
                        .background(rowBackgroundColor(isNext: isNextPrayer, isPast: isPastPrayer))
                        .clipShape(.rect(cornerRadius: isNextPrayer ? 7 : 5))
                        .overlay(
                            RoundedRectangle(cornerRadius: isNextPrayer ? 7 : 5)
                                .strokeBorder(
                                    isNextPrayer
                                        ? NedaaColors.primary(for: colorScheme).opacity(0.3)
                                        : Color.clear,
                                    lineWidth: isNextPrayer ? 1.5 : 0
                                )
                        )
                        .padding(.horizontal, isNextPrayer ? 8 : 0)
                    }
                }
                .padding(.bottom, 3)
            }
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Helper Views

    @ViewBuilder
    private func makePrayerTimeText(prayer: PrayerData, isNext: Bool, isPast: Bool, fontHeight: CGFloat, isTimerActive: Bool) -> some View
    {
        if isTimerActive {
            VStack(alignment: .trailing, spacing: 0) {
                Text(prayer.date, style: .timer)
                    .font(.system(size: fontHeight * 0.52, weight: .bold, design: .rounded))
                    .foregroundStyle(isNext ? NedaaColors.text(for: colorScheme) : NedaaColors.success.opacity(0.8))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .numericContentTransition()

                Text(prayer.date, style: .time)
                    .font(.system(size: fontHeight * 0.42, weight: .medium))
                    .foregroundStyle(NedaaColors.textSecondary(for: colorScheme))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
        } else {
            PrayerTimeText(
                date: prayer.date,
                font: .system(size: fontHeight * 0.65),
                color: NedaaColors.textSecondary(for: colorScheme)
            )
        }
    }

    // MARK: - Helper Functions

    private func prayerNameColor(isNext: Bool, isPast: Bool) -> Color {
        if isNext {
            return NedaaColors.primary(for: colorScheme)
        } else if isPast {
            return NedaaColors.textSecondary(for: colorScheme)
        } else {
            return NedaaColors.text(for: colorScheme).opacity(0.8)
        }
    }

    private func rowBackgroundColor(isNext: Bool, isPast: Bool) -> Color {
        guard showsBackground else { return Color.clear }
        if isNext {
            return NedaaColors.primary(for: colorScheme).opacity(0.15)
        } else if isPast {
            return NedaaColors.success.opacity(0.08)
        } else {
            return Color.clear
        }
    }

    /// Check if timer is enabled in configuration
    private var isTimerEnabled: Bool {
        return entry.showTimer
    }

    /// Check if we should show countdown for next prayer (within 60 minutes)
    private func shouldShowCountdown(for prayer: PrayerData) -> Bool {
        let minutesUntil =
            Calendar.current.dateComponents([.minute], from: entry.date, to: prayer.date).minute ?? 0
        return minutesUntil > 0 && minutesUntil <= 60
    }

    /// Check if we should show count-up for previous prayer (within 30 minutes after)
    private func shouldShowCountUp(for prayer: PrayerData) -> Bool {
        let minutesSince =
            Calendar.current.dateComponents([.minute], from: prayer.date, to: entry.date).minute ?? 0
        return minutesSince >= 0 && minutesSince <= 30
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
