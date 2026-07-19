package expo.modules.notifications.notifications.background

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val UNSUPPORTED_CODE = "E_HMS_REMOTE_NOTIFICATIONS_UNSUPPORTED"
private const val UNSUPPORTED_MESSAGE = "Background remote notifications are unavailable in the HMS build"

class ExpoBackgroundNotificationTasksModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoBackgroundNotificationTasksModule")

    AsyncFunction("registerTaskAsync") { _: String, promise: Promise ->
      promise.reject(UNSUPPORTED_CODE, UNSUPPORTED_MESSAGE, null)
    }

    AsyncFunction("unregisterTaskAsync") { _: String, promise: Promise ->
      promise.reject(UNSUPPORTED_CODE, UNSUPPORTED_MESSAGE, null)
    }
  }
}
