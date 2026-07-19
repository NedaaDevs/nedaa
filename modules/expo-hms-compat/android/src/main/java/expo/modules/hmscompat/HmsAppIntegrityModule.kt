package expo.modules.hmscompat

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val UNSUPPORTED_CODE = "ERR_HMS_APP_INTEGRITY_UNSUPPORTED"
private const val UNSUPPORTED_MESSAGE = "Google Play Integrity is unavailable in the HMS build"

// Keeps @expo/app-integrity's Android API loadable while preserving the app's fail-closed null result.
class HmsAppIntegrityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoAppIntegrity")

    AsyncFunction("prepareIntegrityTokenProviderAsync") { _: String, promise: Promise ->
      promise.reject(UNSUPPORTED_CODE, UNSUPPORTED_MESSAGE, null)
    }

    AsyncFunction("requestIntegrityCheckAsync") { _: String, promise: Promise ->
      promise.reject(UNSUPPORTED_CODE, UNSUPPORTED_MESSAGE, null)
    }

    AsyncFunction("isHardwareAttestationSupportedAsync") {
      false
    }

    AsyncFunction("generateHardwareAttestedKeyAsync") { _: String, _: String, promise: Promise ->
      promise.reject(UNSUPPORTED_CODE, UNSUPPORTED_MESSAGE, null)
    }

    AsyncFunction("getAttestationCertificateChainAsync") { _: String, promise: Promise ->
      promise.reject(UNSUPPORTED_CODE, UNSUPPORTED_MESSAGE, null)
    }
  }
}
