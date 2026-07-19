package expo.modules.hmslocation

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Address
import android.location.Geocoder
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import com.huawei.hms.location.FusedLocationProviderClient
import com.huawei.hms.location.LocationAvailability
import com.huawei.hms.location.LocationCallback
import com.huawei.hms.location.LocationRequest
import com.huawei.hms.location.LocationResult
import com.huawei.hms.location.LocationServices
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.runInterruptible
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout

class ExpoHmsLocationModule : Module() {
  private lateinit var context: Context
  private lateinit var locationProvider: FusedLocationProviderClient
  private val mainHandler = Handler(Looper.getMainLooper())
  private val watchCallbacks = ConcurrentHashMap<Int, LocationCallback>()
  private val currentCallbacks = ConcurrentHashMap<LocationCallback, Runnable>()

  override fun definition() = ModuleDefinition {
    Name(MODULE_NAME)
    Events(LOCATION_EVENT, LOCATION_ERROR_EVENT)

    OnCreate {
      context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      locationProvider = LocationServices.getFusedLocationProviderClient(context)
    }

    AsyncFunction("getForegroundPermissionsAsync") Coroutine { ->
      getForegroundPermissions()
    }

    AsyncFunction("requestForegroundPermissionsAsync") Coroutine { ->
      val permissions = permissionsManager()
      requestPermissions(
        permissions,
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
      )
      getForegroundPermissions()
    }

    AsyncFunction<Boolean>("hasServicesEnabledAsync") {
      hasLocationServicesEnabled()
    }

    AsyncFunction("getCurrentPositionAsync") { options: HmsLocationOptions, promise: Promise ->
      getCurrentPosition(options, promise)
    }

    AsyncFunction("startWatchingAsync") { watchId: Int, options: HmsLocationOptions, promise: Promise ->
      startWatching(watchId, options, promise)
    }

    AsyncFunction("stopWatchingAsync") { watchId: Int, promise: Promise ->
      stopWatching(watchId, promise)
    }

    AsyncFunction("reverseGeocodeAsync") Coroutine { input: ReverseGeocodeInput ->
      reverseGeocode(input)
    }

    OnDestroy {
      removeAllLocationCallbacks()
    }
  }

  private suspend fun getForegroundPermissions(): Map<String, Any?> {
    val permissions = permissionsManager()
    val coarse = getPermissions(permissions, Manifest.permission.ACCESS_COARSE_LOCATION)
    val fine = getPermissions(permissions, Manifest.permission.ACCESS_FINE_LOCATION)
    val coarseGranted = coarse.getBoolean("granted")
    val fineGranted = fine.getBoolean("granted")

    return mapOf(
      "status" to (coarse.getString("status") ?: "undetermined"),
      "granted" to coarseGranted,
      "canAskAgain" to coarse.getBoolean("canAskAgain"),
      "expires" to (coarse.getString("expires") ?: "never"),
      "android" to mapOf(
        "accuracy" to when {
          fineGranted -> "fine"
          coarseGranted -> "coarse"
          else -> "none"
        },
      ),
    )
  }

  private fun getCurrentPosition(options: HmsLocationOptions, promise: Promise) {
    if (!hasForegroundPermission()) {
      promise.reject(ERROR_UNAUTHORIZED, "Not authorized to use location services", null)
      return
    }
    if (!hasLocationServicesEnabled()) {
      promise.reject(ERROR_SERVICES_DISABLED, "Location services are disabled", null)
      return
    }

    lateinit var callback: LocationCallback
    callback = object : LocationCallback() {
      override fun onLocationResult(result: LocationResult?) {
        val location = result?.locations?.lastOrNull()
        if (location == null) {
          return
        }
        // Location Kit can emit a cached fix as soon as updates start. A 30-second ceiling admits
        // normal provider latency but prevents prayer calculations from accepting an old city fix.
        if (!location.isFreshForCurrentRequest()) return

        finishCurrentRequest(callback) {
          promise.resolve(location.toResponse())
        }
      }

      override fun onLocationAvailability(availability: LocationAvailability?) {
        if (availability?.isLocationAvailable == false) {
          finishCurrentRequest(callback) {
            promise.reject(ERROR_UNAVAILABLE, "Location is unavailable; check device location settings", null)
          }
        }
      }
    }

    val timeout = Runnable {
      finishCurrentRequest(callback) {
        promise.reject(ERROR_TIMEOUT, "Location request timed out", null)
      }
    }
    currentCallbacks[callback] = timeout
    mainHandler.postDelayed(timeout, CURRENT_LOCATION_TIMEOUT_MS)

    try {
      locationProvider.requestLocationUpdates(options.toLocationRequest(), callback, Looper.getMainLooper())
        .addOnFailureListener { error ->
          finishCurrentRequest(callback) {
            promise.reject(ERROR_REQUEST_FAILED, "Huawei Location Kit request failed: ${error.message}", error)
          }
        }
    } catch (error: Exception) {
      finishCurrentRequest(callback) {
        promise.reject(ERROR_REQUEST_FAILED, "Huawei Location Kit request failed: ${error.message}", error)
      }
    }
  }

  private fun startWatching(watchId: Int, options: HmsLocationOptions, promise: Promise) {
    if (!hasForegroundPermission()) {
      promise.reject(ERROR_UNAUTHORIZED, "Not authorized to use location services", null)
      return
    }
    if (!hasLocationServicesEnabled()) {
      promise.reject(ERROR_SERVICES_DISABLED, "Location services are disabled", null)
      return
    }
    if (watchCallbacks.containsKey(watchId)) {
      promise.reject(ERROR_DUPLICATE_WATCH, "Location watch $watchId is already active", null)
      return
    }

    val callback = object : LocationCallback() {
      override fun onLocationResult(result: LocationResult?) {
        val location = result?.locations?.lastOrNull()
        if (location == null) {
          sendLocationError(watchId, "Huawei Location Kit returned no location")
          return
        }
        sendEvent(
          LOCATION_EVENT,
          mapOf("watchId" to watchId, "location" to location.toResponse()),
        )
      }

      override fun onLocationAvailability(availability: LocationAvailability?) {
        if (availability?.isLocationAvailable == false) {
          sendLocationError(watchId, "Location is unavailable; check device location settings")
        }
      }
    }
    watchCallbacks[watchId] = callback

    try {
      locationProvider.requestLocationUpdates(options.toLocationRequest(), callback, Looper.getMainLooper())
        .addOnSuccessListener {
          promise.resolve(null)
        }
        .addOnFailureListener { error ->
          watchCallbacks.remove(watchId, callback)
          removeLocationUpdates(callback)
          promise.reject(ERROR_REQUEST_FAILED, "Huawei Location Kit watch failed: ${error.message}", error)
        }
    } catch (error: Exception) {
      watchCallbacks.remove(watchId, callback)
      removeLocationUpdates(callback)
      promise.reject(ERROR_REQUEST_FAILED, "Huawei Location Kit watch failed: ${error.message}", error)
    }
  }

  private fun stopWatching(watchId: Int, promise: Promise) {
    val callback = watchCallbacks[watchId]
    if (callback == null) {
      promise.resolve(null)
      return
    }

    try {
      locationProvider.removeLocationUpdates(callback)
        .addOnSuccessListener {
          watchCallbacks.remove(watchId, callback)
          promise.resolve(null)
        }
        .addOnFailureListener { error ->
          sendLocationError(watchId, "Failed to stop Huawei Location Kit updates: ${error.message}")
          promise.reject(ERROR_REMOVE_FAILED, "Failed to stop Huawei Location Kit updates: ${error.message}", error)
        }
    } catch (error: Exception) {
      sendLocationError(watchId, "Failed to stop Huawei Location Kit updates: ${error.message}")
      promise.reject(ERROR_REMOVE_FAILED, "Failed to stop Huawei Location Kit updates: ${error.message}", error)
    }
  }

  private fun finishCurrentRequest(callback: LocationCallback, completion: () -> Unit) {
    val timeout = currentCallbacks.remove(callback) ?: return
    mainHandler.removeCallbacks(timeout)
    removeLocationUpdates(callback)
    completion()
  }

  private fun removeLocationUpdates(callback: LocationCallback) {
    try {
      locationProvider.removeLocationUpdates(callback)
        .addOnFailureListener { error ->
          Log.w(TAG, "Failed to remove Huawei Location Kit callback", error)
        }
    } catch (error: Exception) {
      Log.w(TAG, "Failed to remove Huawei Location Kit callback", error)
    }
  }

  private fun removeAllLocationCallbacks() {
    currentCallbacks.forEach { (callback, timeout) ->
      mainHandler.removeCallbacks(timeout)
      removeLocationUpdates(callback)
    }
    currentCallbacks.clear()
    watchCallbacks.values.forEach(::removeLocationUpdates)
    watchCallbacks.clear()
  }

  private fun sendLocationError(watchId: Int, reason: String) {
    sendEvent(LOCATION_ERROR_EVENT, mapOf("watchId" to watchId, "reason" to reason))
  }

  private fun hasForegroundPermission(): Boolean {
    return context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
      context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
  }

  private fun hasLocationServicesEnabled(): Boolean {
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return false
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      manager.isLocationEnabled
    } else {
      manager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
        manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }
  }

  private fun HmsLocationOptions.toLocationRequest(): LocationRequest {
    val requestedInterval = timeInterval ?: if (accuracy >= ACCURACY_HIGH) 2_000L else 5_000L
    return LocationRequest().apply {
      interval = requestedInterval.coerceAtLeast(MIN_LOCATION_INTERVAL_MS)
      priority = if (accuracy >= ACCURACY_HIGH) {
        LocationRequest.PRIORITY_HIGH_ACCURACY
      } else {
        LocationRequest.PRIORITY_BALANCED_POWER_ACCURACY
      }
      distanceInterval?.let { smallestDisplacement = it.coerceAtLeast(0.0).toFloat() }
    }
  }

  private fun Location.toResponse(): Map<String, Any?> {
    val altitudeAccuracy = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && hasVerticalAccuracy()) {
      verticalAccuracyMeters.toDouble()
    } else {
      null
    }
    val mocked = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) isMock else isFromMockProvider

    return mapOf(
      "coords" to mapOf(
        "latitude" to latitude,
        "longitude" to longitude,
        "altitude" to if (hasAltitude()) altitude else null,
        "accuracy" to if (hasAccuracy()) accuracy.toDouble() else null,
        "altitudeAccuracy" to altitudeAccuracy,
        "heading" to if (hasBearing()) bearing.toDouble() else null,
        "speed" to if (hasSpeed()) speed.toDouble() else null,
      ),
      "timestamp" to time.toDouble(),
      "mocked" to mocked,
    )
  }

  private fun Location.isFreshForCurrentRequest(): Boolean {
    val ageMillis = if (elapsedRealtimeNanos > 0L) {
      TimeUnit.NANOSECONDS.toMillis(
        (SystemClock.elapsedRealtimeNanos() - elapsedRealtimeNanos).coerceAtLeast(0L),
      )
    } else {
      (System.currentTimeMillis() - time).coerceAtLeast(0L)
    }
    return ageMillis <= MAX_CURRENT_FIX_AGE_MS
  }

  private suspend fun reverseGeocode(input: ReverseGeocodeInput): List<Map<String, Any?>> {
    if (!Geocoder.isPresent()) {
      throw CodedException(ERROR_GEOCODER_UNAVAILABLE, "No Android geocoder is available on this device", null)
    }
    val geocoder = Geocoder(context, Locale.getDefault())
    val addresses = try {
      withTimeout(GEOCODER_TIMEOUT_MS) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          reverseGeocodeApi33(geocoder, input)
        } else {
          runInterruptible(Dispatchers.IO) {
            @Suppress("DEPRECATION")
            geocoder.getFromLocation(input.latitude, input.longitude, 1).orEmpty()
          }
        }
      }
    } catch (error: TimeoutCancellationException) {
      throw CodedException(ERROR_GEOCODER_TIMEOUT, "Reverse geocoding timed out", error)
    } catch (error: CodedException) {
      throw error
    } catch (error: Exception) {
      throw CodedException(ERROR_GEOCODER_FAILED, "Reverse geocoding failed: ${error.message}", error)
    }
    return addresses.map { address -> address.toResponse() }
  }

  private suspend fun reverseGeocodeApi33(
    geocoder: Geocoder,
    input: ReverseGeocodeInput,
  ): List<Address> = suspendCancellableCoroutine { continuation ->
    geocoder.getFromLocation(
      input.latitude,
      input.longitude,
      1,
      object : Geocoder.GeocodeListener {
        override fun onGeocode(addresses: MutableList<Address>) {
          if (continuation.isActive) continuation.resume(addresses)
        }

        override fun onError(errorMessage: String?) {
          if (continuation.isActive) {
            continuation.resumeWithException(
              CodedException(ERROR_GEOCODER_FAILED, errorMessage ?: "Reverse geocoding failed", null),
            )
          }
        }
      },
    )
  }

  private fun Address.toResponse(): Map<String, Any?> {
    val formattedAddress = if (maxAddressLineIndex < 0) {
      null
    } else {
      (0..maxAddressLineIndex).mapNotNull(::getAddressLine).joinToString(", ").ifEmpty { null }
    }
    return mapOf(
      "city" to locality,
      "district" to subLocality,
      "streetNumber" to subThoroughfare,
      "street" to thoroughfare,
      "region" to adminArea,
      "subregion" to subAdminArea,
      "country" to countryName,
      "postalCode" to postalCode,
      "name" to featureName,
      "isoCountryCode" to countryCode,
      "timezone" to null,
      "formattedAddress" to formattedAddress,
    )
  }

  private fun permissionsManager(): Permissions = appContext.permissions
    ?: throw CodedException(ERROR_PERMISSIONS_UNAVAILABLE, "Expo permissions module is unavailable", null)

  private suspend fun getPermissions(
    permissions: Permissions,
    vararg permissionNames: String,
  ): Bundle = permissionsRequest(false, permissions, *permissionNames)

  private suspend fun requestPermissions(
    permissions: Permissions,
    vararg permissionNames: String,
  ): Bundle = permissionsRequest(true, permissions, *permissionNames)

  private suspend fun permissionsRequest(
    shouldAsk: Boolean,
    permissions: Permissions,
    vararg permissionNames: String,
  ): Bundle = suspendCoroutine { continuation ->
    val promise = object : Promise {
      override fun resolve(value: Any?) {
        val bundle = value as? Bundle
        if (bundle == null) {
          continuation.resumeWithException(
            CodedException(ERROR_PERMISSIONS_UNAVAILABLE, "Permissions module returned an invalid response", null),
          )
        } else {
          continuation.resume(bundle)
        }
      }

      override fun reject(code: String?, message: String?, cause: Throwable?) {
        continuation.resumeWithException(CodedException(code, message, cause))
      }
    }
    if (shouldAsk) {
      Permissions.askForPermissionsWithPermissionsManager(permissions, promise, *permissionNames)
    } else {
      Permissions.getPermissionsWithPermissionsManager(permissions, promise, *permissionNames)
    }
  }

  companion object {
    private const val MODULE_NAME = "ExpoHmsLocation"
    private const val TAG = "ExpoHmsLocation"
    private const val LOCATION_EVENT = "onLocationUpdate"
    private const val LOCATION_ERROR_EVENT = "onLocationError"
    private const val ACCURACY_HIGH = 4
    private const val MIN_LOCATION_INTERVAL_MS = 500L
    private const val CURRENT_LOCATION_TIMEOUT_MS = 9_000L
    private const val MAX_CURRENT_FIX_AGE_MS = 30_000L
    private const val GEOCODER_TIMEOUT_MS = 10_000L
    private const val ERROR_UNAUTHORIZED = "E_LOCATION_UNAUTHORIZED"
    private const val ERROR_SERVICES_DISABLED = "E_LOCATION_SERVICES_DISABLED"
    private const val ERROR_UNAVAILABLE = "E_LOCATION_UNAVAILABLE"
    private const val ERROR_TIMEOUT = "E_LOCATION_TIMEOUT"
    private const val ERROR_REQUEST_FAILED = "E_LOCATION_REQUEST_FAILED"
    private const val ERROR_REMOVE_FAILED = "E_LOCATION_REMOVE_FAILED"
    private const val ERROR_DUPLICATE_WATCH = "E_LOCATION_DUPLICATE_WATCH"
    private const val ERROR_GEOCODER_UNAVAILABLE = "E_GEOCODER_UNAVAILABLE"
    private const val ERROR_GEOCODER_FAILED = "E_GEOCODER_FAILED"
    private const val ERROR_GEOCODER_TIMEOUT = "E_GEOCODER_TIMEOUT"
    private const val ERROR_PERMISSIONS_UNAVAILABLE = "E_PERMISSIONS_UNAVAILABLE"
  }
}

@OptimizedRecord
internal class HmsLocationOptions(
  @Field var accuracy: Int = 3,
  @Field var distanceInterval: Double? = null,
  @Field var mayShowUserSettingsDialog: Boolean = true,
  @Field var timeInterval: Long? = null,
) : Record

@OptimizedRecord
internal class ReverseGeocodeInput(
  @Field var latitude: Double,
  @Field var longitude: Double,
) : Record
