import SwiftUI
import WidgetKit
import AppIntents

@available(iOS 17.0, *)
struct PrayerTimesHomeScreen: Widget {
    let kind: String = "PrayerTimesHomeScreen"
    
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: PrayerTimesConfigurationIntent.self, provider: PrayerHomeScreenProvider()) { entry in
            PrayerTimesHomeScreenEntryView(entry: entry)
                .containerBackground(for: .widget) {
                    WidgetBackgroundView()
                }
        }
        .configurationDisplayName(NSLocalizedString("prayerTimesWidgetTitle", comment: ""))
        .description(NSLocalizedString("prayerTimesWidgetDesc", comment: ""))
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct PrayerTimesHomeScreenEntryView: View {
    var entry: PrayerHomeScreenEntry
    @Environment(\.widgetFamily) var widgetFamily
    
    var body: some View {
        switch widgetFamily {
        case .systemSmall:
            SmallPrayerTimesView(entry: entry)
        case .systemMedium:
            MediumPrayerTimesListView(entry: entry)
            
            // timeline view
            // MediumPrayerTimesView(entry: entry)
        case .systemLarge:
            LargePrayerTimesView(entry: entry)
        default:
            SmallPrayerTimesView(entry: entry)
        }
    }
}

#if swift(>=5.9)
@available(iOS 17.0, *)
#Preview(as: .systemSmall) {
    PrayerTimesHomeScreen()
} timeline: {
    PrayerHomeScreenEntry.preview
}

@available(iOS 17.0, *)
#Preview(as: .systemMedium) {
    PrayerTimesHomeScreen()
} timeline: {
    PrayerHomeScreenEntry.preview
}

@available(iOS 17.0, *)
#Preview(as: .systemLarge) {
    PrayerTimesHomeScreen()
} timeline: {
    PrayerHomeScreenEntry.preview
}
#endif

