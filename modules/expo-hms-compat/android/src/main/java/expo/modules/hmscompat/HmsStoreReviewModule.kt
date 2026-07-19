package expo.modules.hmscompat

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val UNAVAILABLE_CODE = "ERR_HMS_STORE_REVIEW_UNAVAILABLE"
private const val UNAVAILABLE_MESSAGE = "In-app store review is unavailable in the HMS build"

// Preserves expo-store-review's safe availability contract without bundling Google Play Review.
class HmsStoreReviewModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoStoreReview")

    AsyncFunction("isAvailableAsync") {
      false
    }

    AsyncFunction("requestReview") { promise: Promise ->
      promise.reject(UNAVAILABLE_CODE, UNAVAILABLE_MESSAGE, null)
    }
  }
}
