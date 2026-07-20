package expo.modules.orientation

import android.content.Context

/** Huawei devices have no fused-orientation equivalent; callers fall back to the rotation vector. */
object FopHelper {
    fun isAvailable(context: Context): Boolean = false

    fun start(
        context: Context,
        onSample: (headingDegrees: Float, headingErrorDegrees: Float, elapsedRealtimeNs: Long) -> Unit,
    ): Boolean = false

    fun stop(context: Context) {}
}
