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
        maghribTime: Date? = nil,
        showTimer: Bool = false
    ) -> [Date] {
        var dates: Set<Date> = []

        // 1. Current moment (always)
        dates.insert(currentDate)

        // 2. Ramadan: 45min before Imsak (suhoor urgency)
        if isRamadan, let imsak = imsakTime, imsak.addingTimeInterval(-2700) > currentDate {
            dates.insert(imsak.addingTimeInterval(-2700))
        }

        // 3. Ramadan: at Imsak + (when timer enabled) at Imsak+30min (count-up cap)
        if isRamadan, let imsak = imsakTime {
            if imsak > currentDate {
                dates.insert(imsak)
            }
            if showTimer {
                let countUpCap = imsak.addingTimeInterval(1800)
                if countUpCap > currentDate {
                    dates.insert(countUpCap)
                }
            }
        }

        // 4. Each prayer today: at prayer time (future only).
        //    When timer is enabled, also add prayer-60min (countdown start) and prayer+30min
        //    (count-up cap). The count-up cap is scheduled whenever it is still in the future —
        //    including for a prayer that already passed but is within its 30min count-up window —
        //    so a timeline regenerated mid-count-up still gets an entry to stop the timer.
        for prayer in todayPrayers {
            if prayer.date > currentDate {
                dates.insert(prayer.date)
            }
            if showTimer {
                let countdownStart = prayer.date.addingTimeInterval(-3600)
                if countdownStart > currentDate {
                    dates.insert(countdownStart)
                }
                let countUpCap = prayer.date.addingTimeInterval(1800)
                if countUpCap > currentDate {
                    dates.insert(countUpCap)
                }
            }
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
        //    Include countdown/count-up entries when timer is enabled
        if let fajr = tomorrowPrayers?.first {
            if showTimer {
                let countdownStart = fajr.date.addingTimeInterval(-3600)
                if countdownStart > currentDate {
                    dates.insert(countdownStart)
                }
            }
            dates.insert(fajr.date)
            if showTimer {
                dates.insert(fajr.date.addingTimeInterval(1800))
            }
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

    // MARK: - Combined Widget Half Selection

    /// The prayer the timer/highlight currently focuses on: the just-passed prayer during
    /// its count-up window, otherwise the next prayer.
    static func focusPrayer(
        at entryDate: Date,
        previousPrayer: PrayerData?,
        nextPrayer: PrayerData?,
        timerEnabled: Bool
    ) -> PrayerData? {
        switch timerPhase(
            at: entryDate, previousPrayer: previousPrayer, nextPrayer: nextPrayer, timerEnabled: timerEnabled
        ) {
        case .countUp(let prayer), .countdown(let prayer), .absoluteTime(let prayer):
            return prayer
        case .none:
            return nextPrayer
        }
    }

    /// Whether the first half (indices 0..<3) of the prayer list should be shown — i.e. it
    /// contains the focus prayer. Defaults to the first half when focus can't be located.
    static func showsFirstHalf(focus: PrayerData?, in prayers: [PrayerData]) -> Bool {
        guard let focus = focus,
              let index = prayers.firstIndex(where: { $0.isSame(as: focus) }) else {
            return true
        }
        return index < 3
    }
}
