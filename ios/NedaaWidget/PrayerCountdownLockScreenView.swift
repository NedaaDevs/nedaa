import WidgetKit
import SwiftUI
import Intents


struct CountdownLockScreenViewProvider: IntentTimelineProvider {
    typealias Entry = PrayerEntry
    typealias Intent = ConfigurationIntent
    
    func placeholder(in context: Context) -> PrayerEntry {
        PrayerEntry(date: Date(), configuration: ConfigurationIntent(), nextPrayer: PrayerData(name: NSLocalizedString("isha", comment: "isha"), date: Date().addingTimeInterval(3600)), previousPrayer: PrayerData(name: "isha", date: Date().addingTimeInterval(3600)) )
    }
    
    func getSnapshot(for configuration: ConfigurationIntent, in context: Context, completion: @escaping (PrayerEntry) -> ()) {
        let entry = PrayerEntry(date: Date(), configuration: configuration, nextPrayer: PrayerData(name: NSLocalizedString("isha", comment: "isha"), date: Date().addingTimeInterval(3600)), previousPrayer: PrayerData(name: NSLocalizedString("isha", comment: "isha"), date: Date().addingTimeInterval(3600)))
        completion(entry)
    }
    
    func getTimeline(for configuration: ConfigurationIntent, in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> ()) {
        var _: [PrayerEntry] = []
        let prayerService = PrayerDataService()
        let showSunrise = configuration.showSunrise as! Bool?
        let nextPrayer = prayerService.getNextPrayer(showSunrise: showSunrise ?? true) ?? PrayerData(name: "GET NOT WOKRING", date: Date())
        let previousPrayer = prayerService.getPreviousPrayer(showSunrise: showSunrise ?? true) ?? PrayerData(name: "GET NOT WOKRING", date: Date())
        let currentDate = Date()
        
        let nextUpdateDate = calculateNextUpdateDate(currentDate: currentDate, nextPrayerDate: nextPrayer.date, previousPrayerDate: previousPrayer.date)
        
        let entry = PrayerEntry(date: currentDate,configuration: configuration, nextPrayer: nextPrayer, previousPrayer: previousPrayer)
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdateDate))
        let dateformat = DateFormatter()
        dateformat.dateFormat = "h:mm a"
        
        completion(timeline)
    }
    
    func calculateNextUpdateDate(currentDate: Date, nextPrayerDate: Date, previousPrayerDate: Date) -> Date {
        let timeIntervalToNextPrayer = nextPrayerDate.timeIntervalSince(currentDate)
        let timeIntervalSincePreviousPrayer = currentDate.timeIntervalSince(previousPrayerDate)
        
        if timeIntervalSincePreviousPrayer < 1800 {
            // If the previous prayer was less than 30 minutes ago, update 30 minutes after the previous prayer
            return previousPrayerDate.addingTimeInterval(1800)
        } else if timeIntervalToNextPrayer > 3600 {
            // If the next prayer is more than 1 hour away, update 60 minutes before the next prayer
            return nextPrayerDate.addingTimeInterval(-3600)
        } else {
            // Otherwise, update 30 minutes after the next prayer
            return nextPrayerDate.addingTimeInterval(1800)
        }
    }
}

@available(iOSApplicationExtension 16.0, *)
struct PrayerCountdownLockScreenView: View {
    var entry: CountdownLockScreenViewProvider.Entry
    
    // get the widget family
    @Environment(\.widgetFamily)
    var family
    var body: some View {
        switch family {
        case .accessoryRectangular:
            RectangularView(entry: entry)
        case .accessoryCircular:
            CircularView(entry: entry)
        default:
            Text("Select a family")
        }
    }
    
}

@available(iOSApplicationExtension 16.0, *)
struct RectangularView: View {
    var entry: CountdownLockScreenViewProvider.Entry
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                dataToShow(entry: entry, geometry: geometry, widgetFamily: .accessoryRectangular)
            }
        }.widgetBackground(Color.clear)
    }
}

@available(iOSApplicationExtension 16.0, *)
struct CircularView: View {
    var entry: CountdownLockScreenViewProvider.Entry
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                dataToShow(entry: entry, geometry: geometry, widgetFamily:  .accessoryCircular)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }.widgetBackground(Color.clear)
    }
}

@available(iOSApplicationExtension 16.0, *)
func dataToShow(entry: CountdownLockScreenViewProvider.Entry, geometry: GeometryProxy, widgetFamily: WidgetFamily  ) -> some View {
    let fontSize: Double = widgetFamily == WidgetFamily.accessoryCircular ? 0.22 : 0.4
    return Group {
        if let nextPrayer = entry.nextPrayer, let previousPrayer = entry.previousPrayer {
            // Check if the previous prayer was within the last 30 minutes
            if Calendar.current.dateComponents([.minute], from: previousPrayer.date, to: Date()).minute ?? 0 < 30 && (entry.configuration.showTimer == true) {
                VStack {
                    Text(NSLocalizedString(previousPrayer.name, comment: "Previous prayer"))
                        .multilineTextAlignment(.center)
                        .font(.system(size: geometry.size.width * fontSize))
                    Text(previousPrayer.date, style: .timer)
                        .multilineTextAlignment(.center)
                        .lineLimit(1)
                        .font(.system(size: geometry.size.width * fontSize))
                }
            }
            else {
                VStack {
                    Text(NSLocalizedString(nextPrayer.name, comment: "Next prayer"))
                        .font(.system(size: geometry.size.width * fontSize))
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                    
                    
                    if Calendar.current.dateComponents([.minute], from: Date(), to: nextPrayer.date).minute ?? 0 <= 60 && (entry.configuration.showTimer == true) {
                        Text(nextPrayer.date, style: .timer)
                            .multilineTextAlignment(.center)
                            .lineLimit(1)
                    }
                    else {
                        Text(nextPrayer.date, style: .time)
                            .lineLimit(1)
                            .minimumScaleFactor(0.5)
                            .font(.system(size: geometry.size.width * fontSize))
                    }
                }
            }
        }
    }
}

@available(iOSApplicationExtension 16.0, *)
struct PrayerCountdownLockScreenWidget: Widget {
    let kind: String = "PrayerCountdownLockScreenWidget"
    
    var body: some WidgetConfiguration {
        IntentConfiguration(kind: kind, intent: ConfigurationIntent.self, provider: Provider()) { entry in
            PrayerCountdownLockScreenView(entry: entry)
        }
        .configurationDisplayName(NSLocalizedString("nextPrayerLockScreenWidgetTitle", comment: "Lock screen widget title"))
        .description(NSLocalizedString("nextPrayerLockScreenWidgetDesc", comment: "Lock screen widget description"))
        .supportedFamilies([.accessoryCircular, .accessoryRectangular])
        .contentMarginsDisabledIfAvailable()
        
    }
}

@available(iOSApplicationExtension 16.0, *)
struct PrayerCountdownLockScreenView_Previews: PreviewProvider {
    static var previews: some View {
        PrayerCountdownLockScreenView(entry: PrayerEntry(date: Date(), configuration: ConfigurationIntent(), nextPrayer: PrayerData(name: "Maghrib", date: Date()), previousPrayer: PrayerData(name: "Maghrib", date: Date())))
            .previewContext(WidgetPreviewContext(family: .accessoryCircular))
    }
}
