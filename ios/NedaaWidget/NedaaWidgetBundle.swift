import WidgetKit
import SwiftUI





@main
struct NedaaWidgetBundle {
    static func main() {
        if #available(iOSApplicationExtension 17.0, *) {
            WidgetsBundle17.main()
        } else if #available(iOSApplicationExtension 16.0, *) {
            WidgetsBundle16.main()
        }
    }
}

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
