import WidgetKit
import SwiftUI
import ActivityKit

#if canImport(AlarmKit)
import AlarmKit
#endif


@main
struct NedaaWidgetBundle {
    static func main() {
        // iOS 26.1+ with AlarmKit support
        #if canImport(AlarmKit)
        if #available(iOSApplicationExtension 26.1, *) {
            WidgetsBundle26.main()
            return
        }
        #endif

        // Fallback for older iOS versions
        if #available(iOSApplicationExtension 17.0, *) {
            WidgetsBundle17.main()
        } else if #available(iOSApplicationExtension 16.0, *) {
            WidgetsBundle16.main()
        }
    }
}

// MARK: - iOS 26.1+ Bundle (with AlarmKit)

#if canImport(AlarmKit)
@available(iOSApplicationExtension 26.1, *)
struct WidgetsBundle26: WidgetBundle {
    var body: some Widget {
        // Lock Screen Widgets
        PrayerCountdownLockScreenWidget()
        MorningPrayerWidget()
        EveningPrayerWidget()

        // Home Screen Widgets
        PrayerTimesHomeScreen()
        QadaHomeScreen()
        AthkarProgressWidget()
        PrayerAthkarWidget()

        // Live Activities
        AlarmLiveActivity()  // Regular Live Activity (fallback)
        AlarmKitCountdownWidget()  // AlarmKit countdown (Dynamic Island)
    }
}
#endif

@available(iOSApplicationExtension 17.0, *)
struct WidgetsBundle17: WidgetBundle {
    var body: some Widget {
        // Lock Screen Widgets
        PrayerCountdownLockScreenWidget()
        MorningPrayerWidget()
        EveningPrayerWidget()

        // Home Screen Widgets
        PrayerTimesHomeScreen()
        QadaHomeScreen()
        AthkarProgressWidget()
        PrayerAthkarWidget()

        // Live Activity
        AlarmLiveActivity()
    }
}

@available(iOSApplicationExtension 16.0, *)
struct WidgetsBundle16: WidgetBundle {
    var body: some Widget {
        // Home Screen Widgets
        QadaHomeScreen()
        AthkarProgressWidget()
    }
}
