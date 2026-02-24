import SwiftUI

enum WidgetIcons {
    static func prayerIcon(for name: String) -> String {
        switch name.lowercased() {
        case "fajr":     return "sunrise.fill"
        case "sunrise":  return "sunrise"
        case "dhuhr":    return "sun.max.fill"
        case "jumuah":   return "sun.max.fill"
        case "asr":      return "sun.haze.fill"
        case "maghrib":  return "sunset.fill"
        case "isha":     return "moon.stars.fill"
        case "imsak":    return "moon.haze.fill"
        case "iftar":    return "sunset.fill"
        default:         return "clock.fill"
        }
    }

    static func headerIcon(isRamadan: Bool) -> String {
        isRamadan ? "moon.stars.fill" : "moon.stars.fill"
    }
}
