package expo.modules.notifications.topics

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val UNSUPPORTED_CODE = "E_HMS_REMOTE_NOTIFICATIONS_UNSUPPORTED"
private const val UNSUPPORTED_MESSAGE = "Remote push notification topics are unavailable in the HMS build"

class TopicSubscriptionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoTopicSubscriptionModule")

    AsyncFunction("subscribeToTopicAsync") { _: String, promise: Promise ->
      promise.reject(UNSUPPORTED_CODE, UNSUPPORTED_MESSAGE, null)
    }

    AsyncFunction("unsubscribeFromTopicAsync") { _: String, promise: Promise ->
      promise.reject(UNSUPPORTED_CODE, UNSUPPORTED_MESSAGE, null)
    }
  }
}
