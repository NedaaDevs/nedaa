package expo.modules.orientation

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.abs

class ExpoOrientationModule : Module() {

    private val context: Context
        get() = requireNotNull(appContext.reactContext)

    private var sensorManager: SensorManager? = null
    private var sensorListener: SensorEventListener? = null
    private var activeSource: String = "rotation_vector"
    private var isWatching = false

    // Smoothing
    private var lastHeading: Float = 0f
    private var hasLastHeading = false

    override fun definition() = ModuleDefinition {
        Name("ExpoOrientation")

        Events("onHeadingUpdate")

        Function("startWatching") {
            if (!isWatching) {
                isWatching = true
                if (!(BuildConfig.HAS_GMS && tryStartFop(context))) {
                    val sm = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
                        ?: return@Function null
                    sensorManager = sm
                    val rotationSensor = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
                    if (rotationSensor != null) {
                        startRotationVector(sm, rotationSensor)
                    } else {
                        startAccelMag(sm)
                    }
                }
            }
            null
        }

        Function("stopWatching") {
            stopAll()
            null
        }

        OnDestroy {
            stopAll()
        }
    }

    // --- FOP (GMS only) ---

    private fun tryStartFop(ctx: Context): Boolean {
        if (!BuildConfig.HAS_GMS) return false
        try {
            return FopHelper.start(ctx) { heading, accuracy ->
                emitHeading(heading, accuracy, "fop")
            }
        } catch (_: Throwable) {
            return false
        }
    }

    private fun stopFop() {
        if (!BuildConfig.HAS_GMS) return
        try {
            FopHelper.stop(context)
        } catch (_: Throwable) {}
    }

    // --- TYPE_ROTATION_VECTOR ---

    private fun startRotationVector(sm: SensorManager, sensor: Sensor) {
        activeSource = "rotation_vector"
        val rotationMatrix = FloatArray(9)
        val orientation = FloatArray(3)

        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
                SensorManager.getOrientation(rotationMatrix, orientation)

                var azimuth = Math.toDegrees(orientation[0].toDouble()).toFloat()
                if (azimuth < 0) azimuth += 360f

                val smoothed = smoothHeading(azimuth)
                val accuracy = mapAccuracy(event.accuracy)

                emitHeading(smoothed, accuracy, activeSource)
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }

        sensorListener = listener
        sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_UI)
    }

    // --- Accelerometer + Magnetometer fallback ---

    private fun startAccelMag(sm: SensorManager) {
        activeSource = "accelerometer_magnetometer"
        val accelSensor = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        val magSensor = sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)

        if (accelSensor == null || magSensor == null) return

        val gravity = FloatArray(3)
        val magnetic = FloatArray(3)
        val rotationMatrix = FloatArray(9)
        val orientation = FloatArray(3)
        val alpha = 0.45f

        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                when (event.sensor.type) {
                    Sensor.TYPE_ACCELEROMETER -> {
                        for (i in 0..2) gravity[i] = gravity[i] + alpha * (event.values[i] - gravity[i])
                    }
                    Sensor.TYPE_MAGNETIC_FIELD -> {
                        for (i in 0..2) magnetic[i] = magnetic[i] + alpha * (event.values[i] - magnetic[i])

                        val success = SensorManager.getRotationMatrix(rotationMatrix, null, gravity, magnetic)
                        if (!success) return

                        SensorManager.getOrientation(rotationMatrix, orientation)
                        var azimuth = Math.toDegrees(orientation[0].toDouble()).toFloat()
                        if (azimuth < 0) azimuth += 360f

                        val smoothed = smoothHeading(azimuth)
                        val accuracy = mapAccuracy(event.accuracy)

                        emitHeading(smoothed, accuracy, activeSource)
                    }
                }
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }

        sensorListener = listener
        sm.registerListener(listener, accelSensor, SensorManager.SENSOR_DELAY_UI)
        sm.registerListener(listener, magSensor, SensorManager.SENSOR_DELAY_UI)
    }

    // --- Helpers ---

    private fun emitHeading(heading: Float, accuracy: Float, source: String) {
        sendEvent("onHeadingUpdate", mapOf(
            "heading" to heading.toDouble(),
            "accuracy" to accuracy.toDouble(),
            "source" to source
        ))
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
        val smoothingAlpha = 0.3f
        var smoothed = lastHeading + smoothingAlpha * diff
        if (smoothed < 0) smoothed += 360
        if (smoothed >= 360) smoothed -= 360
        lastHeading = smoothed
        return smoothed
    }

    private fun mapAccuracy(sensorAccuracy: Int): Float {
        return when (sensorAccuracy) {
            SensorManager.SENSOR_STATUS_ACCURACY_HIGH -> 15f
            SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM -> 30f
            SensorManager.SENSOR_STATUS_ACCURACY_LOW -> 45f
            else -> -1f
        }
    }

    private fun stopAll() {
        isWatching = false
        sensorListener?.let { sensorManager?.unregisterListener(it) }
        sensorListener = null
        sensorManager = null
        stopFop()
        hasLastHeading = false
    }
}
