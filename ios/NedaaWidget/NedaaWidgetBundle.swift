import WidgetKit
import SwiftUI





@main
struct NedaaWidgetBundle {
    static func main() {
        if #available(iOSApplicationExtension 16.0, *) {
            WidgetsBundle16.main()
        }
//      else {
//            CommonWidgetsBundle.main()
//        }
    }
}

@available(iOSApplicationExtension 16.0, *)
struct WidgetsBundle16: WidgetBundle {
    var body: some Widget {
        PrayerCountdownLockScreenWidget()
        MorningPrayerWidget()
        EveningPrayerWidget()
    }
}


//struct CommonWidgetsBundle: WidgetBundle {
//    var body: some Widget {
////        PrayerCountdownWidget()
////        AllPrayersWidget()
//    }
//}
