package expo.modules.orientation

import android.content.Context
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.Surface
import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoOrientationModule : Module() {

    private val context: Context
        get() = requireNotNull(appContext.reactContext)

    private var sensorManager: SensorManager? = null
    private var sensorListener: SensorEventListener? = null
    private var activeSource = SOURCE_ROTATION_VECTOR
    private var activeSession = 0L
    private var isWatching = false
    private var lastHeading = 0f
    private var lastInvalidError: String? = null

    // FOP delivers on its own executor thread while the watchdog runs on main; both flags are
    // written from one and read from the other.
    @Volatile
    private var isFopActive = false

    @Volatile
    private var hasFopSample = false

    private val mainHandler = Handler(Looper.getMainLooper())
    private var fopWatchdog: Runnable? = null

    override fun definition() = ModuleDefinition {
        Name("ExpoOrientation")

        Events("onHeadingUpdate")

        Function("startWatching") { options: Map<String, Any> ->
            startSensors(options)
        }

        Function("stopWatching") {
            stopAll()
            null
        }

        OnDestroy {
            stopAll()
        }
    }

    private fun startSensors(options: Map<String, Any>) {
        stopAll()

        activeSession += 1
        val session = activeSession
        isWatching = true
        lastInvalidError = null

        val reference = resolveHeadingReference(options)
        val sm = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        if (sm == null) {
            Log.e(TAG, "Compass start failed: sensor service unavailable")
            emitInvalid(
                source = SOURCE_UNKNOWN,
                northReference = reference.northReference,
                error = ERROR_SENSOR_UNAVAILABLE,
            )
            isWatching = false
            return
        }

        sensorManager = sm

        if (isFopEligible(options, reference) && startFop(sm, reference, session)) return

        startRotationVectorOrFallback(sm, reference, session)
    }

    /**
     * FOP applies magnetic declination itself, but only when Play Services holds a location fix,
     * and it never reports which reference frame it used. A fresh fix of our own is the evidence
     * that Play Services has one too; on a saved fix we decline FOP and correct declination
     * ourselves via the rotation-vector path.
     */
    private fun isFopEligible(options: Map<String, Any>, reference: HeadingReference): Boolean {
        if (reference.northReference != NORTH_REFERENCE_TRUE) return false
        val locationTimestamp = options.finiteDouble("locationTimestamp") ?: return false
        val age = System.currentTimeMillis() - locationTimestamp.toLong()
        return age >= 0 && age <= MAX_FRESH_LOCATION_AGE_MS
    }

    private fun startFop(sm: SensorManager, reference: HeadingReference, session: Long): Boolean {
        activeSource = SOURCE_FOP
        hasFopSample = false

        val started = FopHelper.start(context) { headingDegrees, headingErrorDegrees, elapsedRealtimeNs ->
            if (!isCurrentSession(session, SOURCE_FOP)) return@start

            val heading = normalizeHeading(headingDegrees)
            if (!heading.isFinite()) {
                emitInvalid(
                    source = SOURCE_FOP,
                    northReference = reference.northReference,
                    error = ERROR_INVALID_HEADING,
                )
                return@start
            }

            if (!hasFopSample) {
                hasFopSample = true
                cancelFopWatchdog()
                Log.i(TAG, "FOP delivered its first sample; staying on $SOURCE_FOP")
            }

            lastHeading = heading
            // FOP already applied declination; adding reference.declinationDegrees would double-correct.
            emitHeading(
                heading = heading,
                accuracyDegrees = fopAccuracyDegrees(headingErrorDegrees),
                northReference = NORTH_REFERENCE_TRUE,
                source = SOURCE_FOP,
                timestamp = sensorTimestampToEpoch(elapsedRealtimeNs),
            )
        }

        if (!started) {
            Log.i(TAG, "FOP unavailable; using $SOURCE_ROTATION_VECTOR")
            return false
        }

        isFopActive = true
        Log.i(TAG, "Compass starting source=$SOURCE_FOP reference=$NORTH_REFERENCE_TRUE")
        scheduleFopWatchdog(sm, reference, session)
        return true
    }

    /** FOP can accept a request and then never deliver; demote to the rotation vector if so. */
    private fun scheduleFopWatchdog(sm: SensorManager, reference: HeadingReference, session: Long) {
        val watchdog = Runnable {
            if (!isCurrentSession(session, SOURCE_FOP) || hasFopSample) return@Runnable
            Log.w(TAG, "FOP produced no sample in ${FOP_STARTUP_TIMEOUT_MS}ms; falling back")
            stopFop()
            startRotationVectorOrFallback(sm, reference, session)
        }
        fopWatchdog = watchdog
        mainHandler.postDelayed(watchdog, FOP_STARTUP_TIMEOUT_MS)
    }

    private fun cancelFopWatchdog() {
        fopWatchdog?.let { mainHandler.removeCallbacks(it) }
        fopWatchdog = null
    }

    private fun stopFop() {
        cancelFopWatchdog()
        if (!isFopActive) return
        isFopActive = false
        hasFopSample = false
        FopHelper.stop(context)
    }

    /** FOP reports 180 when it cannot bound the heading error; that is unknown, not a huge error. */
    private fun fopAccuracyDegrees(headingErrorDegrees: Float): Double? {
        val value = headingErrorDegrees.toDouble()
        if (!value.isFinite() || value < 0.0 || value >= INVALID_HEADING_ERROR_DEGREES) return null
        return value
    }

    private fun startRotationVectorOrFallback(
        sm: SensorManager,
        reference: HeadingReference,
        session: Long,
    ) {
        val rotationSensor = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
        if (rotationSensor != null) {
            Log.i(TAG, "Compass starting source=$SOURCE_ROTATION_VECTOR reference=${reference.northReference}")
            startRotationVector(sm, rotationSensor, reference, session)
        } else {
            Log.w(TAG, "Rotation vector unavailable; trying accelerometer and magnetometer")
            startAccelMag(sm, reference, session)
        }
    }

    private fun startRotationVector(
        sm: SensorManager,
        sensor: Sensor,
        reference: HeadingReference,
        session: Long,
    ) {
        activeSource = SOURCE_ROTATION_VECTOR
        val rawRotationMatrix = FloatArray(9)
        val displayRotationMatrix = FloatArray(9)
        val orientation = FloatArray(3)

        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                if (!isCurrentSession(session, SOURCE_ROTATION_VECTOR)) return

                try {
                    SensorManager.getRotationMatrixFromVector(rawRotationMatrix, event.values)
                } catch (error: RuntimeException) {
                    Log.w(TAG, "Invalid rotation-vector sample", error)
                    emitInvalid(
                        source = SOURCE_ROTATION_VECTOR,
                        northReference = reference.northReference,
                        error = ERROR_INVALID_HEADING,
                        timestamp = sensorTimestampToEpoch(event.timestamp),
                    )
                    return
                }

                if (!getDisplayOrientation(rawRotationMatrix, displayRotationMatrix, orientation)) {
                    emitInvalid(
                        source = SOURCE_ROTATION_VECTOR,
                        northReference = reference.northReference,
                        error = ERROR_INVALID_HEADING,
                        timestamp = sensorTimestampToEpoch(event.timestamp),
                    )
                    return
                }

                val magneticHeading = Math.toDegrees(orientation[0].toDouble()).toFloat()
                val heading = normalizeHeading(magneticHeading + reference.declinationDegrees)
                if (!heading.isFinite()) {
                    emitInvalid(
                        source = SOURCE_ROTATION_VECTOR,
                        northReference = reference.northReference,
                        error = ERROR_INVALID_HEADING,
                        timestamp = sensorTimestampToEpoch(event.timestamp),
                    )
                    return
                }
                lastHeading = heading

                if (event.accuracy <= SensorManager.SENSOR_STATUS_UNRELIABLE) {
                    emitInvalid(
                        heading = heading,
                        source = SOURCE_ROTATION_VECTOR,
                        northReference = reference.northReference,
                        error = ERROR_SENSOR_UNRELIABLE,
                        timestamp = sensorTimestampToEpoch(event.timestamp),
                    )
                    return
                }

                // values[4] is -1 when the HAL cannot estimate heading error. The attitude is still
                // usable, so publish the heading with an unknown bound rather than withholding a
                // direction; consumers must not claim alignment without a bound.
                emitHeading(
                    heading = heading,
                    accuracyDegrees = rotationVectorAccuracyDegrees(event),
                    northReference = reference.northReference,
                    source = SOURCE_ROTATION_VECTOR,
                    timestamp = sensorTimestampToEpoch(event.timestamp),
                )
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
                if (!isCurrentSession(session, SOURCE_ROTATION_VECTOR)) return
                if (accuracy <= SensorManager.SENSOR_STATUS_UNRELIABLE) {
                    emitInvalid(
                        heading = lastHeading,
                        source = SOURCE_ROTATION_VECTOR,
                        northReference = reference.northReference,
                        error = ERROR_SENSOR_UNRELIABLE,
                    )
                }
            }
        }

        sensorListener = listener
        val registered = sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_GAME)
        if (!registered) {
            Log.e(TAG, "Compass registration failed for $SOURCE_ROTATION_VECTOR")
            emitInvalid(
                source = SOURCE_ROTATION_VECTOR,
                northReference = reference.northReference,
                error = ERROR_SENSOR_REGISTRATION_FAILED,
            )
            stopFailedRegistration(session)
        }
    }

    private fun startAccelMag(
        sm: SensorManager,
        reference: HeadingReference,
        session: Long,
    ) {
        activeSource = SOURCE_ACCELEROMETER_MAGNETOMETER
        val accelSensor = sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        val magSensor = sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)

        if (accelSensor == null || magSensor == null) {
            Log.e(TAG, "Compass start failed: required fallback sensors unavailable")
            emitInvalid(
                source = SOURCE_ACCELEROMETER_MAGNETOMETER,
                northReference = reference.northReference,
                error = ERROR_SENSOR_UNAVAILABLE,
            )
            isWatching = false
            return
        }

        Log.i(
            TAG,
            "Compass starting source=$SOURCE_ACCELEROMETER_MAGNETOMETER reference=${reference.northReference}",
        )
        val gravity = FloatArray(3)
        val magnetic = FloatArray(3)
        val rawRotationMatrix = FloatArray(9)
        val displayRotationMatrix = FloatArray(9)
        val orientation = FloatArray(3)
        val alpha = 0.45f
        var hasGravity = false
        var hasMagnetic = false

        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                if (!isCurrentSession(session, SOURCE_ACCELEROMETER_MAGNETOMETER)) return

                when (event.sensor.type) {
                    Sensor.TYPE_ACCELEROMETER -> {
                        for (index in 0..2) {
                            gravity[index] += alpha * (event.values[index] - gravity[index])
                        }
                        hasGravity = true
                    }

                    Sensor.TYPE_MAGNETIC_FIELD -> {
                        for (index in 0..2) {
                            magnetic[index] += alpha * (event.values[index] - magnetic[index])
                        }
                        hasMagnetic = true
                    }
                }

                if (!hasGravity || !hasMagnetic || event.sensor.type != Sensor.TYPE_MAGNETIC_FIELD) {
                    return
                }

                val hasRotationMatrix = SensorManager.getRotationMatrix(
                    rawRotationMatrix,
                    null,
                    gravity,
                    magnetic,
                )
                if (!hasRotationMatrix ||
                    !getDisplayOrientation(rawRotationMatrix, displayRotationMatrix, orientation)
                ) {
                    emitInvalid(
                        source = SOURCE_ACCELEROMETER_MAGNETOMETER,
                        northReference = reference.northReference,
                        error = ERROR_SENSOR_UNRELIABLE,
                        timestamp = sensorTimestampToEpoch(event.timestamp),
                    )
                    return
                }

                val magneticHeading = Math.toDegrees(orientation[0].toDouble()).toFloat()
                val heading = normalizeHeading(magneticHeading + reference.declinationDegrees)
                if (!heading.isFinite()) {
                    emitInvalid(
                        source = SOURCE_ACCELEROMETER_MAGNETOMETER,
                        northReference = reference.northReference,
                        error = ERROR_INVALID_HEADING,
                        timestamp = sensorTimestampToEpoch(event.timestamp),
                    )
                    return
                }
                lastHeading = heading

                if (isMagneticallyDisturbed(magnetic, reference.expectedFieldMicroTesla)) {
                    emitInvalid(
                        heading = heading,
                        source = SOURCE_ACCELEROMETER_MAGNETOMETER,
                        northReference = reference.northReference,
                        error = ERROR_SENSOR_UNRELIABLE,
                        timestamp = sensorTimestampToEpoch(event.timestamp),
                    )
                    return
                }

                if (event.accuracy <= SensorManager.SENSOR_STATUS_UNRELIABLE) {
                    emitInvalid(
                        heading = heading,
                        source = SOURCE_ACCELEROMETER_MAGNETOMETER,
                        northReference = reference.northReference,
                        error = ERROR_SENSOR_UNRELIABLE,
                        timestamp = sensorTimestampToEpoch(event.timestamp),
                    )
                    return
                }

                // This path derives heading from raw vectors and has no error estimate at all.
                emitHeading(
                    heading = heading,
                    accuracyDegrees = null,
                    northReference = reference.northReference,
                    source = SOURCE_ACCELEROMETER_MAGNETOMETER,
                    timestamp = sensorTimestampToEpoch(event.timestamp),
                )
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
                if (!isCurrentSession(session, SOURCE_ACCELEROMETER_MAGNETOMETER)) return
                if (sensor?.type == Sensor.TYPE_MAGNETIC_FIELD &&
                    accuracy <= SensorManager.SENSOR_STATUS_UNRELIABLE
                ) {
                    emitInvalid(
                        heading = lastHeading,
                        source = SOURCE_ACCELEROMETER_MAGNETOMETER,
                        northReference = reference.northReference,
                        error = ERROR_SENSOR_UNRELIABLE,
                    )
                }
            }
        }

        sensorListener = listener
        val accelerometerRegistered = sm.registerListener(
            listener,
            accelSensor,
            SensorManager.SENSOR_DELAY_GAME,
        )
        val magnetometerRegistered = sm.registerListener(
            listener,
            magSensor,
            SensorManager.SENSOR_DELAY_GAME,
        )

        if (!accelerometerRegistered || !magnetometerRegistered) {
            Log.e(
                TAG,
                "Compass fallback registration failed " +
                    "accelerometer=$accelerometerRegistered magnetometer=$magnetometerRegistered",
            )
            emitInvalid(
                source = SOURCE_ACCELEROMETER_MAGNETOMETER,
                northReference = reference.northReference,
                error = ERROR_SENSOR_REGISTRATION_FAILED,
            )
            stopFailedRegistration(session)
        }
    }

    private fun getDisplayOrientation(
        rawRotationMatrix: FloatArray,
        displayRotationMatrix: FloatArray,
        orientation: FloatArray,
    ): Boolean {
        val (axisX, axisY) = when (currentDisplayRotation()) {
            Surface.ROTATION_90 -> SensorManager.AXIS_Y to SensorManager.AXIS_MINUS_X
            Surface.ROTATION_180 -> SensorManager.AXIS_MINUS_X to SensorManager.AXIS_MINUS_Y
            Surface.ROTATION_270 -> SensorManager.AXIS_MINUS_Y to SensorManager.AXIS_X
            else -> SensorManager.AXIS_X to SensorManager.AXIS_Y
        }
        val remapped = SensorManager.remapCoordinateSystem(
            rawRotationMatrix,
            axisX,
            axisY,
            displayRotationMatrix,
        )
        if (!remapped) return false

        SensorManager.getOrientation(displayRotationMatrix, orientation)
        return orientation.all { it.isFinite() }
    }

    @Suppress("DEPRECATION")
    private fun currentDisplayRotation(): Int {
        val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
        return windowManager?.defaultDisplay?.rotation ?: Surface.ROTATION_0
    }

    private fun resolveHeadingReference(options: Map<String, Any>): HeadingReference {
        val latitude = options.finiteDouble("latitude")
        val longitude = options.finiteDouble("longitude")
        val hasLocationInput = options.containsKey("latitude") || options.containsKey("longitude")

        if (latitude == null || longitude == null ||
            latitude !in -90.0..90.0 || longitude !in -180.0..180.0
        ) {
            if (hasLocationInput) {
                Log.w(TAG, "Compass received invalid location; using magnetic north")
            } else {
                Log.i(TAG, "Compass starting without location; using magnetic north")
            }
            return HeadingReference(0f, NORTH_REFERENCE_MAGNETIC)
        }

        val altitude = options.finiteDouble("altitude")?.toFloat() ?: 0f
        return try {
            // Declination describes the magnetic field now, even when the position came from a saved fix.
            val field = GeomagneticField(
                latitude.toFloat(),
                longitude.toFloat(),
                altitude,
                System.currentTimeMillis(),
            )
            val declination = field.declination
            if (!declination.isFinite()) {
                Log.w(TAG, "Geomagnetic declination unavailable; using magnetic north")
                HeadingReference(0f, NORTH_REFERENCE_MAGNETIC)
            } else {
                // getFieldStrength is nanotesla; the magnetometer reports microtesla.
                val expected = (field.fieldStrength / 1_000f).takeIf { it.isFinite() && it > 0f }
                HeadingReference(declination, NORTH_REFERENCE_TRUE, expected)
            }
        } catch (error: RuntimeException) {
            Log.w(TAG, "Geomagnetic declination failed; using magnetic north", error)
            HeadingReference(0f, NORTH_REFERENCE_MAGNETIC)
        }
    }

    /** A null [accuracyDegrees] means the heading is usable but its error is unknown. */
    private fun emitHeading(
        heading: Float,
        accuracyDegrees: Double?,
        northReference: String,
        source: String,
        timestamp: Long,
    ) {
        lastInvalidError = null
        sendEvent(
            "onHeadingUpdate",
            mapOf<String, Any?>(
                "heading" to heading.toDouble(),
                "accuracyDegrees" to accuracyDegrees,
                "northReference" to northReference,
                "isValid" to true,
                "timestamp" to timestamp.toDouble(),
                "source" to source,
            ),
        )
    }

    private fun emitInvalid(
        heading: Float = lastHeading,
        source: String,
        northReference: String,
        error: String,
        timestamp: Long = System.currentTimeMillis(),
    ) {
        if (lastInvalidError == error) return

        lastInvalidError = error
        Log.w(TAG, "Compass sample invalid source=$source error=$error")

        sendEvent(
            "onHeadingUpdate",
            mapOf<String, Any?>(
                "heading" to normalizeHeading(heading).toDouble(),
                "accuracyDegrees" to null,
                "northReference" to northReference,
                "isValid" to false,
                "timestamp" to timestamp.toDouble(),
                "source" to source,
                "error" to error,
            ),
        )
    }

    private fun stopFailedRegistration(session: Long) {
        if (activeSession != session) return
        stopFop()
        sensorListener?.let { sensorManager?.unregisterListener(it) }
        sensorListener = null
        sensorManager = null
        isWatching = false
    }

    private fun stopAll() {
        stopFop()
        activeSession += 1
        isWatching = false
        sensorListener?.let { sensorManager?.unregisterListener(it) }
        sensorListener = null
        sensorManager = null
        lastHeading = 0f
        lastInvalidError = null
    }

    private fun isCurrentSession(session: Long, source: String): Boolean {
        return isWatching && activeSession == session && activeSource == source
    }

    private fun rotationVectorAccuracyDegrees(event: SensorEvent): Double? {
        val radians = event.values.getOrNull(4)?.toDouble() ?: return null
        if (!radians.isFinite() || radians < 0.0) return null

        return Math.toDegrees(radians).takeIf { it.isFinite() && it <= 180.0 }
    }

    /**
     * Earth's field runs 25-65uT. A measured magnitude far from the modelled value means a nearby
     * magnet or ferrous mass is bending the field, which the HAL often fails to flag.
     */
    private fun isMagneticallyDisturbed(magnetic: FloatArray, expectedMicroTesla: Float?): Boolean {
        val expected = expectedMicroTesla ?: return false
        val magnitude = kotlin.math.sqrt(
            magnetic[0] * magnetic[0] + magnetic[1] * magnetic[1] + magnetic[2] * magnetic[2],
        )
        if (!magnitude.isFinite() || magnitude <= 0f) return false
        return kotlin.math.abs(magnitude - expected) > expected * FIELD_DEVIATION_TOLERANCE
    }

    private fun normalizeHeading(degrees: Float): Float {
        if (!degrees.isFinite()) return 0f
        return ((degrees % 360f) + 360f) % 360f
    }

    private fun sensorTimestampToEpoch(timestampNanos: Long): Long {
        val bootTimeEpochMs = System.currentTimeMillis() - SystemClock.elapsedRealtime()
        return bootTimeEpochMs + timestampNanos / NANOS_PER_MILLISECOND
    }

    private fun Map<String, Any>.finiteDouble(key: String): Double? {
        return (this[key] as? Number)?.toDouble()?.takeIf { it.isFinite() }
    }

    private data class HeadingReference(
        val declinationDegrees: Float,
        val northReference: String,
        val expectedFieldMicroTesla: Float? = null,
    )

    private companion object {
        const val TAG = "ExpoOrientation"

        const val SOURCE_UNKNOWN = "unknown"
        const val SOURCE_ROTATION_VECTOR = "rotation_vector"
        const val SOURCE_ACCELEROMETER_MAGNETOMETER = "accelerometer_magnetometer"
        const val SOURCE_FOP = "fop"

        const val NORTH_REFERENCE_TRUE = "true"
        const val NORTH_REFERENCE_MAGNETIC = "magnetic"

        const val ERROR_SENSOR_UNAVAILABLE = "sensor_unavailable"
        const val ERROR_SENSOR_REGISTRATION_FAILED = "sensor_registration_failed"
        const val ERROR_SENSOR_UNRELIABLE = "sensor_unreliable"
        const val ERROR_INVALID_HEADING = "invalid_heading"

        const val NANOS_PER_MILLISECOND = 1_000_000L

        const val FOP_STARTUP_TIMEOUT_MS = 2_000L
        const val MAX_FRESH_LOCATION_AGE_MS = 2 * 60 * 1_000L
        const val INVALID_HEADING_ERROR_DEGREES = 180.0
        const val FIELD_DEVIATION_TOLERANCE = 0.35f
    }
}
