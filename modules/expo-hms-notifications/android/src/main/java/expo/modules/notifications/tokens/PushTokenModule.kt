package expo.modules.notifications.tokens

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val UNSUPPORTED_CODE = "E_HMS_REMOTE_NOTIFICATIONS_UNSUPPORTED"
private const val UNSUPPORTED_MESSAGE = "Remote push notifications are unavailable in the HMS build"

class PushTokenModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoPushTokenManager")
    Events("onDevicePushToken")

    AsyncFunction("getDevicePushTokenAsync") { promise: Promise ->
      promise.reject(UNSUPPORTED_CODE, UNSUPPORTED_MESSAGE, null)
    }

    AsyncFunction("unregisterForNotificationsAsync") { promise: Promise ->
      promise.reject(UNSUPPORTED_CODE, UNSUPPORTED_MESSAGE, null)
    }
  }
}
