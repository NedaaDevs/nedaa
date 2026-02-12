import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Widget Configuration Intent

@available(iOS 17.0, *)
struct PrayerCountdownConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "widget_prayer_countdown_settings"
    static var description = IntentDescription("widget_prayer_countdown_settings_desc")
    
    @Parameter(title: "widget_show_timer", default: true)
    var showTimer: Bool
    
    @Parameter(title: "widget_show_sunrise", default: true)
    var showSunrise: Bool
}

// MARK: - Timeline Entry

struct PrayerCountdownEntry: TimelineEntry {
    let date: Date
    let nextPrayer: PrayerData?
    let previousPrayer: PrayerData?
    let showTimer: Bool
    let showSunrise: Bool

    var relevance: TimelineEntryRelevance? {
        prayerTimelineRelevance(nextPrayerDate: nextPrayer?.date, previousPrayerDate: previousPrayer?.date, currentDate: date)
    }
}

// MARK: - Timeline Provider

@available(iOS 17.0, *)
struct CountdownLockScreenViewProvider: AppIntentTimelineProvider {
    typealias Entry = PrayerCountdownEntry
    typealias Intent = PrayerCountdownConfigurationIntent
    
    private let prayerService = PrayerDataService()
    
    func placeholder(in context: Context) -> PrayerCountdownEntry {
        PrayerCountdownEntry(
            date: Date(),
            nextPrayer: PrayerData(name: "isha", date: Date().addingTimeInterval(3600)),
            previousPrayer: PrayerData(name: "maghrib", date: Date().addingTimeInterval(-1800)),
            showTimer: true,
            showSunrise: true
        )
    }
    
    func snapshot(for configuration: PrayerCountdownConfigurationIntent, in context: Context) async -> PrayerCountdownEntry {
        return createEntry(for: Date(), configuration: configuration)
    }
    
    func timeline(for configuration: PrayerCountdownConfigurationIntent, in context: Context) async -> Timeline<PrayerCountdownEntry> {
        let currentDate = Date()
        let entry = createEntry(for: currentDate, configuration: configuration)
        
        let nextUpdateDate = calculateNextUpdateDate(
            currentDate: currentDate,
            nextPrayerDate: entry.nextPrayer?.date ?? currentDate.addingTimeInterval(3600),
            previousPrayerDate: entry.previousPrayer?.date ?? currentDate
        )
        
        return Timeline(entries: [entry], policy: .after(nextUpdateDate))
    }
    
    private func createEntry(for date: Date, configuration: PrayerCountdownConfigurationIntent) -> PrayerCountdownEntry {
        let showSunrise = configuration.showSunrise
        let showTimer = configuration.showTimer
        
        let nextPrayer = prayerService.getNextPrayer(showSunrise: showSunrise) ?? PrayerData(name: "Error", date: Date())
        let previousPrayer = prayerService.getPreviousPrayer(showSunrise: showSunrise) ?? PrayerData(name: "Error", date: Date())
        
        return PrayerCountdownEntry(
            date: date,
            nextPrayer: nextPrayer,
            previousPrayer: previousPrayer,
            showTimer: showTimer,
            showSunrise: showSunrise
        )
    }
    
    private func calculateNextUpdateDate(currentDate: Date, nextPrayerDate: Date, previousPrayerDate: Date) -> Date {
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

@available(iOSApplicationExtension 17.0, *)
struct PrayerCountdownLockScreenView: View {
    var entry: PrayerCountdownEntry
    
    @Environment(\.widgetFamily) var family
    
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

@available(iOSApplicationExtension 17.0, *)
struct RectangularView: View {
    var entry: PrayerCountdownEntry
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                dataToShow(entry: entry, geometry: geometry, widgetFamily: .accessoryRectangular)
            }
        }.widgetBackground(Color.clear)
    }
}

@available(iOSApplicationExtension 17.0, *)
struct CircularView: View {
    var entry: PrayerCountdownEntry
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                dataToShow(entry: entry, geometry: geometry, widgetFamily: .accessoryCircular)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }.widgetBackground(Color.clear)
    }
}

@available(iOSApplicationExtension 17.0, *)
func dataToShow(entry: PrayerCountdownEntry, geometry: GeometryProxy, widgetFamily: WidgetFamily) -> some View {
    let fontSize: Double = widgetFamily == WidgetFamily.accessoryCircular ? 0.25 : 0.18
    return Group {
        if let nextPrayer = entry.nextPrayer, let previousPrayer = entry.previousPrayer {
            // Check if the previous prayer was within the last 30 minutes
            if Calendar.current.dateComponents([.minute], from: previousPrayer.date, to: Date()).minute ?? 0 < 30 && entry.showTimer {
                VStack {
                    Text(NSLocalizedString(previousPrayer.name, comment: "Previous prayer"))
                        .multilineTextAlignment(.center)
                        .font(.system(size: geometry.size.width * fontSize))
                    Text(previousPrayer.date, style: .timer)
                        .multilineTextAlignment(.center)
                        .lineLimit(1)
                        .font(.system(size: geometry.size.width * fontSize))
                }
            } else {
                VStack {
                    Text(NSLocalizedString(nextPrayer.name, comment: "Next prayer"))
                        .font(.system(size: geometry.size.width * fontSize))
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                    
                    if Calendar.current.dateComponents([.minute], from: Date(), to: nextPrayer.date).minute ?? 0 <= 60 && entry.showTimer {
                        Text(nextPrayer.date, style: .timer)
                            .multilineTextAlignment(.center)
                            .lineLimit(1)
                    } else {
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

@available(iOSApplicationExtension 17.0, *)
struct PrayerCountdownLockScreenWidget: Widget {
    let kind: String = "PrayerCountdownLockScreenWidget"
    
    var body: some WidgetConfiguration {
        AppIntentConfiguration(
            kind: kind,
            intent: PrayerCountdownConfigurationIntent.self,
            provider: CountdownLockScreenViewProvider()
        ) { entry in
            PrayerCountdownLockScreenView(entry: entry)
        }
        .configurationDisplayName(NSLocalizedString("nextPrayerLockScreenWidgetTitle", comment: "Lock screen widget title"))
        .description(NSLocalizedString("nextPrayerLockScreenWidgetDesc", comment: "Lock screen widget description"))
        .supportedFamilies([.accessoryCircular, .accessoryRectangular])
        .contentMarginsDisabledIfAvailable()
    }
}

@available(iOSApplicationExtension 17.0, *)
struct PrayerCountdownLockScreenView_Previews: PreviewProvider {
    static var previews: some View {
        PrayerCountdownLockScreenView(
            entry: PrayerCountdownEntry(
                date: Date(),
                nextPrayer: PrayerData(name: "Maghrib", date: Date()),
                previousPrayer: PrayerData(name: "Asr", date: Date()),
                showTimer: true,
                showSunrise: true
            )
        )
        .previewContext(WidgetPreviewContext(family: .accessoryCircular))
    }
}
