import WidgetKit
import SwiftUI

let appGroupId = "group.io.nedaa.nedaaApp"



@main
struct NedaaWidgetBundle {
    static func main() {
        if #available(iOSApplicationExtension 16.0, *) {
            WidgetsBundle16.main()
        } else {
            CommonWidgetsBundle.main()
        }
    }
}

@available(iOSApplicationExtension 16.0, *)
struct WidgetsBundle16: WidgetBundle {
    var body: some Widget {
        PrayerCountdownLockScreenWidget()
        PrayerCountdownWidget()
        AllPrayersWidget()
    }
}


struct CommonWidgetsBundle: WidgetBundle {
    var body: some Widget {
        PrayerCountdownWidget()
        AllPrayersWidget()
    }
}
