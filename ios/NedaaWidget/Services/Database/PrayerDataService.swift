import Foundation



struct PrayerDataService {
    var dbService = DatabaseService()
    
    func getDayPrayerTimes(for date: Date, showSunrise: Bool = true) -> [PrayerData]? {
        if dbService.timeZone.isEmpty {
            dbService.getTimezone()
        }
        
        guard let timeZoneObj = TimeZone(identifier: dbService.timeZone) else {
            debugPrint("Error: Could not retrieve timezone")
            
            return nil
            
        };
        let dateInt = getDateInt(for: date, in: timeZoneObj)
        guard var prayerTimes = dbService.getDayPrayerTimes(dateInt: dateInt) else {
            print("Error: No data found for date: \(date)")
            return nil
        }
        
        prayerTimes = prayerTimes.sorted(by: { $0.date < $1.date })
        
        let today = Date().toLocalTime(timezone: timeZoneObj)
        // check if today is Friday and if so, rename Dhuhr to Jumuah
        if Calendar.current.component(.weekday, from: today) == 6 {
            prayerTimes[2].name = "jumuah"
        }
        
        if(showSunrise == false){
            // Remove the sunrise
            // after sorting, the sunrise will always be at index 1
            prayerTimes.remove(at: 1)
        }
        
        return prayerTimes
    }
    
    func getTodaysPrayerTimes(showSunrise: Bool = true) -> [PrayerData]? {
        if dbService.timeZone.isEmpty {
            dbService.getTimezone()
        }
        
        guard let timeZoneObj = TimeZone(identifier: dbService.timeZone) else {
            debugPrint("Error: Could not retrieve timezone")
            
            return nil
            
        };
        let today = Date().toLocalTime(timezone: timeZoneObj)
        let prayers =   getDayPrayerTimes(for: today, showSunrise: showSunrise)
        guard let prayerTimes = prayers else {
            return nil
        }
        
        return prayerTimes
        
    }
    
    func getTomorrowsPrayerTimes(showSunrise: Bool = true) -> [PrayerData]? {
        if dbService.timeZone.isEmpty {
            dbService.getTimezone()
        }
        
        guard let timeZoneObj = TimeZone(identifier: dbService.timeZone) else {
            debugPrint("Error: Could not retrieve timezone")
            
            return nil
            
        };
        
        guard let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date().toLocalTime(timezone: timeZoneObj)) else {
            print("Error: Could not calculate tomorrow's date")
            return nil
        }
        
        return getDayPrayerTimes(for: tomorrow, showSunrise: showSunrise)
    }
    
    func getYesterdaysPrayerTimes() -> [PrayerData]? {
        if dbService.timeZone.isEmpty {
            dbService.getTimezone()
        }
        
        guard let timeZoneObj = TimeZone(identifier: dbService.timeZone) else {
            debugPrint("Error: Could not retrieve timezone")
            
            return nil
            
        };
        
        guard let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date().toLocalTime(timezone: timeZoneObj)) else {
            print("Error: Could not calculate yesterday's date")
            return nil
        };
        return getDayPrayerTimes(for: yesterday)
    }
    
    func getNextPrayer(showSunrise: Bool = true) -> PrayerData? {
        let currentDate = Date()
        guard let prayerTimes = getTodaysPrayerTimes(showSunrise: showSunrise) else {
            return nil
        }
        
        
        // Find the first prayer time that is later than the current date
        for prayer in prayerTimes {
            if prayer.date > currentDate {
                return prayer
            }
        }
        
        // If no prayer times are later than the current date, return the first prayer time of the next day
        guard let firstPrayerNextDay = getTomorrowsPrayerTimes()?.first else {
            // Handle error here
            return nil
        }
        
        return firstPrayerNextDay
    }
    
    func getPreviousPrayer(showSunrise: Bool = true) -> PrayerData? {
        let currentDate = Date()
        guard let prayerTimes = getTodaysPrayerTimes(showSunrise: showSunrise) else {
            return nil
        }
        
        
        // Find the last prayer time that is earlier than the current date
        for prayer in prayerTimes.reversed() {
            if prayer.date < currentDate {
                return prayer
            }
        }
        
        // If no prayer times are earlier than the current date, return the last prayer time of the previous day
        guard let lastPrayerPreviousDay = getYesterdaysPrayerTimes()?.last else {
            // Handle error here
            return nil
        }
        
        return lastPrayerPreviousDay
    }
    
    
    
    private func getDateInt(for date: Date, in timeZone: TimeZone) -> Int {
        var calendar = Calendar.current
        calendar.timeZone = timeZone
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return components.year! * 10000 + components.month! * 100 + components.day!
    }
    
}



