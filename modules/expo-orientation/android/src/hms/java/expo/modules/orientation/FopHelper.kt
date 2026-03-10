package expo.modules.orientation

import android.content.Context

object FopHelper {
    fun start(context: Context, callback: (heading: Float, accuracy: Float) -> Unit): Boolean {
        return false
    }

    fun stop(context: Context) {}
}
