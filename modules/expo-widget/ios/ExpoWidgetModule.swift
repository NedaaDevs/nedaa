import ExpoModulesCore
import WidgetKit

public class ExpoWidgetModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ExpoWidget")

        Function("reloadPrayerWidgets") {
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadTimelines(ofKind: "PrayerTimesHomeScreen")
                WidgetCenter.shared.reloadTimelines(ofKind: "PrayerCountdownLockScreenWidget")
                WidgetCenter.shared.reloadTimelines(ofKind: "InlinePrayerWidget")
                WidgetCenter.shared.reloadTimelines(ofKind: "MorningPrayerWidget")
                WidgetCenter.shared.reloadTimelines(ofKind: "EveningPrayerWidget")
            }
        }

        Function("reloadAllWidgets") {
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
            }
        }
    }
}
