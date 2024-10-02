import SwiftUI
import WidgetKit


let allPrayers: [PrayerData] = [
    PrayerData(name: NSLocalizedString("fajr", comment: ""), date: Date()),
    PrayerData(name: NSLocalizedString("sunrise", comment: ""), date: Date()),
    PrayerData(name: NSLocalizedString("dhuhr", comment: ""), date: Date()),
    PrayerData(name: NSLocalizedString("asr", comment: ""), date: Date()),
    PrayerData(name: NSLocalizedString("maghrib", comment: ""), date: Date()),
    PrayerData(name: NSLocalizedString("isha", comment: ""), date: Date())
]

struct AllPrayersViewProvider: IntentTimelineProvider {
    typealias Entry = AllPrayerEntry
    typealias Intent = ConfigurationIntent
    
    func placeholder(in context: Context) -> AllPrayerEntry {
        AllPrayerEntry(date: Date(), configuration: ConfigurationIntent(), allPrayers: allPrayers, nextPrayer: PrayerData(name: "Fajr", date: Date()))
    }
    
    func getSnapshot(for configuration: ConfigurationIntent, in context: Context, completion: @escaping (AllPrayerEntry) -> ()) {
        let entry = AllPrayerEntry(date: Date(), configuration: configuration, allPrayers: allPrayers, nextPrayer: PrayerData(name: "Fajr", date: Date()))
        completion(entry)
    }
    
    func getTimeline(for configuration: ConfigurationIntent, in context: Context, completion: @escaping (Timeline<AllPrayerEntry>) -> ()) {
        var _: [AllPrayerEntry] = []
        let prayerService = PrayerDataService()
        let showSunrise = configuration.showSunrise as! Bool?
        var todaysPrayers = prayerService.getTodaysPrayerTimes(showSunrise: showSunrise ?? true)
        let nextPrayer = prayerService.getNextPrayer(showSunrise: showSunrise ?? true) ?? PrayerData(name: "DB ERROR", date: Date())
        let currentDate = Date()
        let nextUpdateDate = calculateNextUpdateDate(currentDate: currentDate, nextPrayerDate: nextPrayer.date)
        
        
        // if the current date is after the last prayer(Isha) of the day, then we need to get tomorrow's prayer times
        if(currentDate > todaysPrayers?.last?.date ?? Date()) {
            todaysPrayers = prayerService.getTomorrowsPrayerTimes(showSunrise: showSunrise ?? true) 
        }
        
        
        let entry = AllPrayerEntry(date: currentDate,configuration: configuration, allPrayers: todaysPrayers, nextPrayer: nextPrayer)
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdateDate))
        let dateformat = DateFormatter()
        dateformat.dateFormat = "h:mm a"
        
        completion(timeline)
    }
    
    func calculateNextUpdateDate(currentDate: Date, nextPrayerDate: Date) -> Date {
        let timeIntervalToNextPrayer = nextPrayerDate.timeIntervalSince(currentDate)
        
        if timeIntervalToNextPrayer > 3600 {
            // If the next prayer is more than 1 hour away, update 60 minutes before the next prayer
            return nextPrayerDate.addingTimeInterval(-3600)
        } else {
            // Otherwise, update 30 minutes after the next prayer
            return nextPrayerDate.addingTimeInterval(1800)
        }
    }
    
}

struct AllPrayerEntry: TimelineEntry {
    let date: Date
    let configuration: ConfigurationIntent
    let allPrayers: [PrayerData]?
    let nextPrayer: PrayerData?
}

struct AllPrayersView: View {
    @Environment(\.colorScheme) var colorScheme
    var entry: AllPrayersViewProvider.Entry
    
    var theme: Theme {
        getTheme(colorScheme: colorScheme)
    }
    
    var body: some View {
        GeometryReader { geometry in
            let totalPadding = CGFloat((entry.allPrayers?.count ?? 1) - 1) * 5.0  // Reduced padding between each HStack
            let availableHeight = geometry.size.height - totalPadding
            let fontHeight = availableHeight / CGFloat(entry.allPrayers?.count ?? 1)
            ZStack {
                theme.backgroundColor.edgesIgnoringSafeArea(.all)
                VStack(alignment: .leading, spacing: 5) {
                    ForEach(entry.allPrayers ?? [], id: \.self.name) { prayer in
                        let isNextPrayer = prayer.name == entry.nextPrayer?.name
                        HStack {
                            Text(NSLocalizedString(prayer.name, comment: ""))
                                .font(.system(size: fontHeight * 0.6))
                                .foregroundColor(isNextPrayer && colorScheme == .dark ? theme.backgroundColor: theme.primaryColor)
                            Spacer()
                            PrayerTimeText(prayer: prayer, fontHeight: fontHeight)
                                .multilineTextAlignment(.trailing)
                            
                        }
                        .padding(.horizontal)
                        .background((isNextPrayer) ? theme.tertiaryColor : Color.clear)
                        .cornerRadius((isNextPrayer) ? 10 : 0)
                        .padding((isNextPrayer) ? .horizontal : [], 10)
                    }
                }
                .padding([.top, .bottom], 5)
            }
        }.widgetBackground(theme.backgroundColor)
    }
    
    func PrayerTimeText(prayer: PrayerData, fontHeight: CGFloat) -> some View {
        let isNextPrayer = prayer.name == entry.nextPrayer?.name
        if isNextPrayer {
            let isSoon = Calendar.current.dateComponents([.minute], from: Date(), to: prayer.date).minute ?? 0 <= 60 && entry.configuration.showTimer == true
            let timeStyle: Text.DateStyle = isSoon ? .timer : .time
            return Text(prayer.date, style: timeStyle)
                .font(.system(size: fontHeight * 0.7))
                .foregroundColor(isNextPrayer && colorScheme == .dark ? theme.backgroundColor: theme.secondaryColor)
            
        } else {
            return Text(prayer.date, style: .time)
                .font(.system(size: fontHeight * 0.7))
                .foregroundColor(isNextPrayer && colorScheme == .dark ?theme.backgroundColor : theme.secondaryColor)
        }
    }
}





struct AllPrayersWidget: Widget {
    let kind: String = "AllPrayersWidget"
    
    
    var body: some WidgetConfiguration {
        IntentConfiguration(kind: kind, intent: ConfigurationIntent.self, provider: AllPrayersViewProvider()) { entry in
            AllPrayersView(entry: entry)
            
        }
        .configurationDisplayName(NSLocalizedString("allPrayersWidgetTitle", comment: ""))
        .description(NSLocalizedString("allPrayersWidgetDesc", comment: ""))
        .supportedFamilies([.systemLarge , .systemMedium])
        .contentMarginsDisabledIfAvailable()
        
    }
}

struct AllPrayersView_Previews: PreviewProvider {
    static var previews: some View {
        AllPrayersView(entry: AllPrayerEntry(date: Date(), configuration: ConfigurationIntent(), allPrayers: [PrayerData(name:NSLocalizedString("maghrib", comment: ""), date: Date())], nextPrayer: allPrayers[0] ))
            .previewContext(WidgetPreviewContext(family: .systemMedium))
    }
}
