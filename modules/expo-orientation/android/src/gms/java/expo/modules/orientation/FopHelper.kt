package expo.modules.orientation

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorManager
import android.util.Log
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.DeviceOrientation
import com.google.android.gms.location.DeviceOrientationListener
import com.google.android.gms.location.DeviceOrientationRequest
import com.google.android.gms.location.LocationServices
import java.util.concurrent.Executors

/**
 * Adapter over the Play Services Fused Orientation Provider. Headings are passed through
 * unsmoothed and are already referenced to true north when Play Services holds a location fix.
 */
object FopHelper {

    private const val TAG = "ExpoOrientationFop"

    private var listener: DeviceOrientationListener? = null
    private val executor = Executors.newSingleThreadExecutor()

    /** FOP needs Play Services plus all three fusion sensors; there is no degraded mode. */
    fun isAvailable(context: Context): Boolean {
        val playServices = GoogleApiAvailability.getInstance()
            .isGooglePlayServicesAvailable(context)
        if (playServices != ConnectionResult.SUCCESS) {
            Log.i(TAG, "FOP unavailable: play services status=$playServices")
            return false
        }

        val sm = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return false
        val missing = listOf(
            Sensor.TYPE_ACCELEROMETER to "accelerometer",
            Sensor.TYPE_GYROSCOPE to "gyroscope",
            Sensor.TYPE_MAGNETIC_FIELD to "magnetometer",
        ).filter { (type, _) -> sm.getDefaultSensor(type) == null }

        if (missing.isNotEmpty()) {
            Log.i(TAG, "FOP unavailable: missing ${missing.joinToString { it.second }}")
            return false
        }
        return true
    }

    fun start(
        context: Context,
        onSample: (headingDegrees: Float, headingErrorDegrees: Float, elapsedRealtimeNs: Long) -> Unit,
    ): Boolean {
        if (!isAvailable(context)) return false

        return try {
            val client = LocationServices.getFusedOrientationProviderClient(context)
            val request = DeviceOrientationRequest.Builder(
                DeviceOrientationRequest.OUTPUT_PERIOD_DEFAULT,
            ).build()

            val orientationListener = DeviceOrientationListener { orientation: DeviceOrientation ->
                onSample(
                    orientation.headingDegrees,
                    orientation.headingErrorDegrees,
                    orientation.elapsedRealtimeNs,
                )
            }

            listener = orientationListener
            // An async Task failure surfaces as no samples; the module's startup watchdog
            // catches that and demotes to the rotation vector.
            client.requestOrientationUpdates(request, executor, orientationListener)
            true
        } catch (error: RuntimeException) {
            Log.w(TAG, "FOP start failed", error)
            listener = null
            false
        }
    }

    fun stop(context: Context) {
        val current = listener ?: return
        listener = null
        try {
            LocationServices.getFusedOrientationProviderClient(context)
                .removeOrientationUpdates(current)
        } catch (error: RuntimeException) {
            Log.w(TAG, "FOP stop failed", error)
        }
    }
}
