package expo.modules.orientation

import android.content.Context
import com.google.android.gms.location.DeviceOrientation
import com.google.android.gms.location.DeviceOrientationListener
import com.google.android.gms.location.DeviceOrientationRequest
import com.google.android.gms.location.LocationServices
import java.util.concurrent.Executors
import kotlin.math.abs

object FopHelper {

    private var listener: DeviceOrientationListener? = null
    private val executor = Executors.newSingleThreadExecutor()

    private var lastHeading: Float = 0f
    private var hasLastHeading = false

    fun start(context: Context, callback: (heading: Float, accuracy: Float) -> Unit): Boolean {
        val client = LocationServices.getFusedOrientationProviderClient(context)

        val request = DeviceOrientationRequest.Builder(
            DeviceOrientationRequest.OUTPUT_PERIOD_DEFAULT
        ).build()

        val orientationListener = DeviceOrientationListener { orientation: DeviceOrientation ->
            val heading = orientation.headingDegrees
            val accuracy = orientation.headingErrorDegrees

            val smoothed = smoothHeading(heading)
            callback(smoothed, accuracy)
        }

        listener = orientationListener
        client.requestOrientationUpdates(request, executor, orientationListener)
        return true
    }

    fun stop(context: Context) {
        listener?.let {
            val client = LocationServices.getFusedOrientationProviderClient(context)
            client.removeOrientationUpdates(it)
        }
        listener = null
        hasLastHeading = false
    }

    private fun smoothHeading(newHeading: Float): Float {
        if (!hasLastHeading) {
            lastHeading = newHeading
            hasLastHeading = true
            return newHeading
        }
        var diff = newHeading - lastHeading
        if (diff > 180) diff -= 360
        if (diff < -180) diff += 360
        if (abs(diff) < 0.5f) return lastHeading
        val alpha = 0.3f
        var smoothed = lastHeading + alpha * diff
        if (smoothed < 0) smoothed += 360
        if (smoothed >= 360) smoothed -= 360
        lastHeading = smoothed
        return smoothed
    }
}
