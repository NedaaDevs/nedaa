import SwiftUI

enum WidgetTypography {
    // Small widget
    static let smallHijri: Font = .system(size: 10)
    static let smallPrayerName: Font = .title2.weight(.bold)
    static let smallTime: Font = .title3.weight(.medium)
    static let smallTimer: Font = .system(size: 22, weight: .semibold, design: .rounded)
    static let smallCaption: Font = .caption2

    // Medium widget
    static let mediumHijri: Font = .system(size: 9)
    static let mediumPrayerName: Font = .system(size: 13, weight: .medium)
    static let mediumPrayerNameActive: Font = .system(size: 13, weight: .bold)
    static let mediumTime: Font = .system(size: 12)
    static let mediumTimer: Font = .system(size: 14, weight: .bold, design: .rounded)
    static let mediumDate: Font = .system(size: 9)

    // Large widget
    static let largeHeader: Font = .subheadline.weight(.bold)
    static let largeSubheader: Font = .caption2
    static let largePrayerName: Font = .callout
    static let largePrayerNameActive: Font = .callout.weight(.semibold)
    static let largeTime: Font = .callout
    static let largeTimer: Font = .callout.weight(.semibold).monospacedDigit()

    // Lock screen
    static let lockScreenPrayerName: Font = .headline
    static let lockScreenTime: Font = .subheadline
    static let lockScreenTimer: Font = .subheadline.monospacedDigit()

    // StandBy mode (distance viewing)
    static let standByPrayerName: Font = .largeTitle.weight(.bold)
    static let standByTime: Font = .title.weight(.medium)
    static let standByTimer: Font = .title.weight(.semibold).monospacedDigit()
}
