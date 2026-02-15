package expo.modules.mediacontrols

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val SERVICE_CLASS = "expo.modules.audio.service.AudioControlsService"

class ExpoMediaControlsModule : Module() {

  private val serviceClass: Class<*>? by lazy {
    try {
      Class.forName(SERVICE_CLASS)
    } catch (_: ClassNotFoundException) {
      null
    }
  }

  private fun setField(name: String, value: Any?) {
    try {
      serviceClass?.getDeclaredField(name)?.apply {
        isAccessible = true
        set(null, value)
      }
    } catch (_: Exception) {}
  }

  private fun callMethod(name: String) {
    try {
      serviceClass?.getDeclaredMethod(name)?.apply {
        isAccessible = true
        invoke(null)
      }
    } catch (_: Exception) {}
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoMediaControls")

    Events("onRemoteNext", "onRemotePrevious")

    Function("enable") {
      setField("trackControlsEnabled", true)

      val onNext: () -> Unit = {
        sendEvent("onRemoteNext", emptyMap<String, Any>())
      }
      val onPrev: () -> Unit = {
        sendEvent("onRemotePrevious", emptyMap<String, Any>())
      }
      setField("onNextTrack", onNext)
      setField("onPreviousTrack", onPrev)

      callMethod("refreshTrackControls")
    }

    Function("disable") {
      setField("trackControlsEnabled", false)
      setField("onNextTrack", null)
      setField("onPreviousTrack", null)

      callMethod("refreshTrackControls")
    }
  }
}
