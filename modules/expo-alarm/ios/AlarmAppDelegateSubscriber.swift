import ExpoModulesCore
import Foundation

/// Registers the alarm wake-up BGTask launch handler.
///
/// BGTaskScheduler resolves a handler the moment it wakes the process, so every identifier
/// in `BGTaskSchedulerPermittedIdentifiers` must be registered before
/// `didFinishLaunchingWithOptions` returns; delivering a task to an unregistered one raises
/// an uncaught NSException. Module `OnCreate` runs only once the JS runtime is up, far too
/// late on a background launch.
public class AlarmAppDelegateSubscriber: ExpoAppDelegateSubscriber {
    public func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Unconditional: the identifier is permitted on every OS version, so it needs a
        // handler on every OS version, even where no wake request is ever submitted.
        AlarmBackgroundTaskManager.shared.registerTask()
        return true
    }
}
