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
            .foregroundColor(color)
            .fixedSize(horizontal: true, vertical: false)
            .minimumScaleFactor(0.7)
    }
}

// MARK: - Small Widget View
struct SmallPrayerTimesView: View {
    let entry: PrayerHomeScreenEntry
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        VStack(spacing: 2) {
            // Hijri date at the top (compact for small widget)
            Text(entry.date.hijriDateStringCompact())
                .font(.system(size: 10))
                .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                .lineLimit(1)
                .padding(.top, 2)

            // Previous Prayer
            if let previousPrayer = entry.previousPrayer {
                VStack(spacing: 2) {
                    Text(LocalizedStringKey(previousPrayer.name))
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                        .lineLimit(1)

                    // Show count-up timer if within 30 minutes after prayer AND timer enabled
                    if shouldShowCountUp(for: previousPrayer) && isTimerEnabled {
                        VStack(spacing: -2) {
                            Text(previousPrayer.date, style: .timer)
                                .font(.system(size: 18, weight: .bold, design: .rounded))
                                .foregroundColor(NedaaColors.success.opacity(0.8))
                                .monospacedDigit()
                                .multilineTextAlignment(.center)
                                .minimumScaleFactor(0.8)
                            
                            Text(previousPrayer.date, style: .time)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(NedaaColors.textSecondary(for: colorScheme).opacity(0.7))
                        }
                        .frame(maxWidth: .infinity)
                    } else {
                        Text(previousPrayer.date, style: .time)
                            .font(.caption2)
                            .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(NedaaColors.success.opacity(0.15))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            // Divider line
            Rectangle()
                .fill(NedaaColors.textSecondary(for: colorScheme).opacity(0.3))
                .frame(height: 1)
                .padding(.horizontal, 20)
                .padding(.vertical, 1)

            // Next Prayer
            if let nextPrayer = entry.nextPrayer {
                VStack(spacing: 4) {
                    Text(LocalizedStringKey(nextPrayer.name))
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(NedaaColors.primary(for: colorScheme))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)

                    // Show countdown timer if within 60 minutes before prayer AND timer enabled
                    if shouldShowCountdown(for: nextPrayer) && isTimerEnabled {
                        VStack(spacing: 0) {
                            Text(nextPrayer.date, style: .timer)
                                .font(.system(size: 18, weight: .semibold, design: .rounded))
                                .foregroundColor(NedaaColors.text(for: colorScheme))
                                .monospacedDigit()
                                .multilineTextAlignment(.center)
                            
                            Text(nextPrayer.date, style: .time)
                                .font(.caption2)
                                .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                        }
                        .frame(maxWidth: .infinity)
                    } else {
                        Text(nextPrayer.date, style: .time)
                            .font(.title3)
                            .fontWeight(.medium)
                            .foregroundColor(NedaaColors.text(for: colorScheme))
                    }

                    // "in X min" label when countdown is active
                    if shouldShowCountdown(for: nextPrayer) && !isTimerEnabled {
                        Text(relativeTimeString(for: nextPrayer.date))
                            .font(.caption2)
                            .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
            } else {
                Text("widget.noPrayerTimes")
                    .font(.caption)
                    .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
            }

            Spacer()
        }
        .padding(.top, 12)
        .padding(.horizontal, 8)
    }

    // MARK: - Helper Functions

    /// Check if timer is enabled in configuration
    private var isTimerEnabled: Bool {
        return entry.showTimer
    }

    /// Check if we should show countdown for next prayer (within 60 minutes)
    private func shouldShowCountdown(for prayer: PrayerData) -> Bool {
        let now = Date()
        let minutesUntil =
            Calendar.current.dateComponents([.minute], from: now, to: prayer.date).minute ?? 0
        return minutesUntil > 0 && minutesUntil <= 60
    }

    /// Check if we should show count-up for previous prayer (within 30 minutes after)
    private func shouldShowCountUp(for prayer: PrayerData) -> Bool {
        let now = Date()
        let minutesSince =
            Calendar.current.dateComponents([.minute], from: prayer.date, to: now).minute ?? 0
        return minutesSince >= 0 && minutesSince <= 30
    }

    /// Generate relative time string (e.g., "in 25 min")
    private func relativeTimeString(for date: Date) -> String {
        let now = Date()
        let components = Calendar.current.dateComponents([.hour, .minute], from: now, to: date)

        if let hours = components.hour, let minutes = components.minute {
            if hours > 0 {
                return String(format: String(localized: "widget.inHoursMinutes"), hours, minutes)
            } else {
                return String(format: String(localized: "widget.inMinutes"), minutes)
            }
        }
        return ""
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
                    .foregroundColor(NedaaColors.primary(for: colorScheme))

                Text(entry.date.hijriDateString())
                    .font(.system(size: 8))
                    .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)

                Spacer()

                Text(entry.date, style: .date)
                    .font(.system(size: 8))
                    .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
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
                            .foregroundColor(NedaaColors.text(for: colorScheme))

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

    var body: some View {
        VStack(spacing: 12) {
            // Header
            HStack {
                Image(systemName: "moon.stars.fill")
                    .font(.title3)
                    .foregroundColor(NedaaColors.primary(for: colorScheme))

                VStack(alignment: .leading, spacing: 2) {
                    Text("widget.prayerTimes")
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .foregroundColor(NedaaColors.text(for: colorScheme))

                    HStack(spacing: 4) {
                        Text(entry.date, style: .date)
                            .font(.caption2)
                            .foregroundColor(NedaaColors.textSecondary(for: colorScheme))

                        Text("•")
                            .font(.caption2)
                            .foregroundColor(NedaaColors.textSecondary(for: colorScheme))

                        Text(entry.date.hijriDateString())
                            .font(.caption2)
                            .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
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
                        .foregroundColor(NedaaColors.primary(for: colorScheme))
                        .font(.caption)

                    Text("widget.nextPrayerIn")
                        .font(.caption)
                        .foregroundColor(NedaaColors.textSecondary(for: colorScheme))

                    Text(nextPrayer.date, style: .relative)
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(NedaaColors.text(for: colorScheme))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(NedaaColors.primary(for: colorScheme).opacity(0.15))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .padding(.bottom, 4)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 12)
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
                .foregroundColor(NedaaColors.text(for: colorScheme))

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
                    .foregroundColor(NedaaColors.success)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(NedaaColors.success.opacity(0.2))
                    .clipShape(Capsule())
            } else if isNext {
                Text("widget.next")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundColor(NedaaColors.primary(for: colorScheme))
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
                        .foregroundColor(NedaaColors.primary(for: colorScheme))

                    Text(entry.date.hijriDateString())
                        .font(.system(size: 9))
                        .foregroundColor(NedaaColors.textSecondary(for: colorScheme))

                    Spacer()

                    Text(entry.date, style: .date)
                        .font(.system(size: 9))
                        .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
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
                                .foregroundColor(
                                    prayerNameColor(isNext: isNextPrayer, isPast: isPastPrayer))

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
                        .cornerRadius(isNextPrayer ? 7 : 5)
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
    }

    // MARK: - Helper Views

    @ViewBuilder
    private func makePrayerTimeText(prayer: PrayerData, isNext: Bool, isPast: Bool, fontHeight: CGFloat, isTimerActive: Bool) -> some View
    {
        if isTimerActive {
            VStack(alignment: .trailing, spacing: 0) {
                Text(prayer.date, style: .timer)
                    .font(.system(size: fontHeight * 0.52, weight: .bold, design: .rounded))
                    .foregroundColor(isNext ? NedaaColors.text(for: colorScheme) : NedaaColors.success.opacity(0.8))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                
                Text(prayer.date, style: .time)
                    .font(.system(size: fontHeight * 0.42, weight: .medium))
                    .foregroundColor(NedaaColors.textSecondary(for: colorScheme))
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
        let now = Date()
        let minutesUntil =
            Calendar.current.dateComponents([.minute], from: now, to: prayer.date).minute ?? 0
        return minutesUntil > 0 && minutesUntil <= 60
    }
    
    /// Check if we should show count-up for previous prayer (within 30 minutes after)
    private func shouldShowCountUp(for prayer: PrayerData) -> Bool {
        let now = Date()
        let minutesSince =
            Calendar.current.dateComponents([.minute], from: prayer.date, to: now).minute ?? 0
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
