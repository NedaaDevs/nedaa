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
        
        var calendar = Calendar.current
        calendar.timeZone = timeZoneObj
        if calendar.component(.weekday, from: date) == 6 {
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
        return getDayPrayerTimes(for: Date(), showSunrise: showSunrise)
    }
    
    func getTomorrowsPrayerTimes(showSunrise: Bool = true) -> [PrayerData]? {
        if dbService.timeZone.isEmpty {
            dbService.getTimezone()
        }

        guard let timeZoneObj = TimeZone(identifier: dbService.timeZone) else {
            debugPrint("Error: Could not retrieve timezone")
            return nil
        }

        var calendar = Calendar.current
        calendar.timeZone = timeZoneObj
        guard let tomorrow = calendar.date(byAdding: .day, value: 1, to: Date()) else {
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
        }

        var calendar = Calendar.current
        calendar.timeZone = timeZoneObj
        guard let yesterday = calendar.date(byAdding: .day, value: -1, to: Date()) else {
            print("Error: Could not calculate yesterday's date")
            return nil
        }

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
    
    
    
    func getImsakTime(for date: Date? = nil) -> PrayerData? {
        if dbService.timeZone.isEmpty {
            dbService.getTimezone()
        }

        guard let timeZoneObj = TimeZone(identifier: dbService.timeZone) else {
            return nil
        }

        let targetDate = date ?? Date()
        let dateInt = getDateInt(for: targetDate, in: timeZoneObj)

        guard let imsakString = dbService.getImsakTime(dateInt: dateInt) else {
            return nil
        }

        do {
            let imsakDate = try dbService.convertStringToDate(timeString: imsakString)
            return PrayerData(name: "imsak", date: imsakDate)
        } catch {
            return nil
        }
    }

    private func getDateInt(for date: Date, in timeZone: TimeZone) -> Int {
        var calendar = Calendar.current
        calendar.timeZone = timeZone
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return components.year! * 10000 + components.month! * 100 + components.day!
    }
    
}



