import Foundation
import WidgetKit

enum PrayerTimelineUtils {

    // MARK: - Ramadan Detection

    static func isRamadan(_ date: Date = Date()) -> Bool {
        Calendar(identifier: .islamicUmmAlQura).component(.month, from: date) == 9
    }

    static func ramadanDay(_ date: Date = Date()) -> Int {
        Calendar(identifier: .islamicUmmAlQura).component(.day, from: date)
    }

    // MARK: - Timeline Entry Date Generation

    /// Generates all dates at which the widget should have a fresh entry.
    /// Each date represents a moment when the widget's visible state changes.
    static func generateEntryDates(
        from currentDate: Date,
        todayPrayers: [PrayerData],
        tomorrowPrayers: [PrayerData]?,
        isRamadan: Bool = false,
        imsakTime: Date? = nil,
        maghribTime: Date? = nil
    ) -> [Date] {
        var dates: Set<Date> = []

        // 1. Current moment (always)
        dates.insert(currentDate)

        // 2. Ramadan: 45min before Imsak (suhoor urgency)
        if isRamadan, let imsak = imsakTime, imsak.addingTimeInterval(-2700) > currentDate {
            dates.insert(imsak.addingTimeInterval(-2700))
        }

        // 3. Ramadan: at Imsak + at Imsak+30min (count-up cap)
        if isRamadan, let imsak = imsakTime, imsak > currentDate {
            dates.insert(imsak)
            dates.insert(imsak.addingTimeInterval(1800))
        }

        // 4. Each future prayer today: at prayer time + at prayer+30min (count-up cap)
        for prayer in todayPrayers where prayer.date > currentDate {
            dates.insert(prayer.date)
            dates.insert(prayer.date.addingTimeInterval(1800))
        }

        // 5. Ramadan: 60min before Maghrib (iftar anticipation)
        if isRamadan, let maghrib = maghribTime, maghrib.addingTimeInterval(-3600) > currentDate {
            dates.insert(maghrib.addingTimeInterval(-3600))
        }

        // 6. Midnight — day rollover
        let startOfTomorrow = Calendar.current.startOfDay(
            for: Calendar.current.date(byAdding: .day, value: 1, to: currentDate) ?? currentDate
        )
        dates.insert(startOfTomorrow)

        // 7. Tomorrow's first prayer (so widget shows correct data after midnight)
        if let fajr = tomorrowPrayers?.first {
            dates.insert(fajr.date)
        }

        // Filter out dates in the past, sort, return
        return dates
            .filter { $0 >= currentDate }
            .sorted()
    }

    // MARK: - Next/Previous Prayer from Date

    /// Find next prayer relative to a given date (not Date()).
    static func nextPrayer(
        at date: Date,
        todayPrayers: [PrayerData],
        tomorrowPrayers: [PrayerData]?
    ) -> PrayerData? {
        if let next = todayPrayers.first(where: { $0.date > date }) {
            return next
        }
        return tomorrowPrayers?.first(where: { $0.date > date })
    }

    /// Find previous prayer relative to a given date (not Date()).
    static func previousPrayer(
        at date: Date,
        todayPrayers: [PrayerData],
        yesterdayPrayers: [PrayerData]?
    ) -> PrayerData? {
        if let prev = todayPrayers.last(where: { $0.date <= date }) {
            return prev
        }
        return yesterdayPrayers?.last(where: { $0.date <= date })
    }

    // MARK: - Timer State

    enum TimerPhase {
        case countUp(prayer: PrayerData)    // 0-30min after athan
        case countdown(prayer: PrayerData)  // <=60min before next
        case absoluteTime(prayer: PrayerData) // gap: show absolute time
        case none
    }

    /// Determines what the widget timer should show at a given entry date.
    static func timerPhase(
        at entryDate: Date,
        previousPrayer: PrayerData?,
        nextPrayer: PrayerData?,
        timerEnabled: Bool
    ) -> TimerPhase {
        guard timerEnabled else {
            if let next = nextPrayer {
                return .absoluteTime(prayer: next)
            }
            return .none
        }

        // Check count-up: 0-30min after previous prayer
        if let prev = previousPrayer {
            let sincePrev = entryDate.timeIntervalSince(prev.date)
            if sincePrev >= 0 && sincePrev < 1800 {
                return .countUp(prayer: prev)
            }
        }

        // Check countdown: <=60min before next prayer
        if let next = nextPrayer {
            let toNext = next.date.timeIntervalSince(entryDate)
            if toNext > 0 && toNext <= 3600 {
                return .countdown(prayer: next)
            }
            if toNext > 0 {
                return .absoluteTime(prayer: next)
            }
        }

        return .none
    }
}
