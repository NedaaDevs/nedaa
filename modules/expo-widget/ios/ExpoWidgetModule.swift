import ExpoModulesCore
import WidgetKit

/// Kinds whose content derives from prayer times. Must stay in step with the
/// widgets registered in NedaaWidgetBundle.swift.
private let prayerWidgetKinds = [
    "PrayerTimesHomeScreen",
    "PrayerCountdownLockScreenWidget",
    "InlinePrayerWidget",
    "MorningPrayerWidget",
    "EveningPrayerWidget",
    "AllPrayersCombinedWidget",
    "PrayerAthkarWidget",
    "SuhoorIftarWidget",
    "RamadanProgressWidget",
]

public class ExpoWidgetModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ExpoWidget")

        Function("reloadPrayerWidgets") {
            if #available(iOS 14.0, *) {
                prayerWidgetKinds.forEach { WidgetCenter.shared.reloadTimelines(ofKind: $0) }
            }
        }

        Function("reloadAllWidgets") {
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
            }
        }

        // The extension writes this file; this target can't share its writer, so
        // the path is repeated here.
        Function("getWidgetLastRenderedAt") { () -> Double in
            guard let url = FileManager.default
                    .containerURL(forSecurityApplicationGroupIdentifier: "group.dev.nedaa.app")?
                    .appendingPathComponent("widget-heartbeat"),
                  let text = try? String(contentsOf: url, encoding: .utf8),
                  let millis = Double(text.trimmingCharacters(in: .whitespacesAndNewlines))
            else { return 0 }
            return millis
        }

        AsyncFunction("getPlacedWidgetCount") { (promise: Promise) in
            guard #available(iOS 14.0, *) else { return promise.resolve(0) }
            WidgetCenter.shared.getCurrentConfigurations { result in
                switch result {
                case .success(let widgets):
                    promise.resolve(widgets.count)
                case .failure(let error):
                    // Rejecting keeps "unknown" distinct from "none placed".
                    promise.reject("ERR_WIDGET_CONFIGURATIONS", error.localizedDescription)
                }
            }
        }
    }
}
