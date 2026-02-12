import BackgroundTasks
import Foundation

@available(iOS 13.0, *)
class AlarmBackgroundTaskManager {
    static let shared = AlarmBackgroundTaskManager()
    static let taskIdentifier = "dev.nedaa.app.alarmWake"

    private init() {}

    func registerTask() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: Self.taskIdentifier, using: nil) { task in
            guard let processingTask = task as? BGProcessingTask else {
                task.setTaskCompleted(success: false)
                return
            }
            self.handleBackgroundTask(processingTask)
        }
        PersistentLog.shared.alarm("BGTask registered: \(Self.taskIdentifier)")
    }

    func scheduleWakeTask(alarmTime: Date, alarmId: String) {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.taskIdentifier)

        let wakeTime = alarmTime.addingTimeInterval(-180)
        let earliestDate = max(wakeTime, Date().addingTimeInterval(15))

        let request = BGProcessingTaskRequest(identifier: Self.taskIdentifier)
        request.earliestBeginDate = earliestDate
        request.requiresNetworkConnectivity = false
        request.requiresExternalPower = false

        do {
            try BGTaskScheduler.shared.submit(request)
            PersistentLog.shared.alarm("BGTask scheduled for \(earliestDate) (alarm: \(alarmId.prefix(8)))")
        } catch {
            PersistentLog.shared.alarm("BGTask schedule failed: \(error.localizedDescription)")
        }
    }

    func cancelWakeTask() {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.taskIdentifier)
        PersistentLog.shared.alarm("BGTask cancelled")
    }

    private func handleBackgroundTask(_ task: BGProcessingTask) {
        PersistentLog.shared.alarm("BGTask running")

        var isCompleted = false

        task.expirationHandler = {
            guard !isCompleted else { return }
            isCompleted = true
            PersistentLog.shared.alarm("BGTask expired")
            task.setTaskCompleted(success: false)
        }

        AlarmObserver.startObserving()

        DispatchQueue.main.asyncAfter(deadline: .now() + 25) {
            guard !isCompleted else { return }
            isCompleted = true
            PersistentLog.shared.alarm("BGTask completing (25s elapsed)")
            task.setTaskCompleted(success: true)
            self.rescheduleIfNeeded()
        }
    }

    private func rescheduleIfNeeded() {
        guard AlarmDatabase.shared.hasAlarms() else { return }

        if let nextAlarmTime = AlarmDatabase.shared.getNextAlarmTime(),
           nextAlarmTime > Date() {
            scheduleWakeTask(alarmTime: nextAlarmTime, alarmId: "reschedule")
        }
    }
}
