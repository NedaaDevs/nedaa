package dev.nedaa.android.widgets.common

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.glance.LocalContext
import androidx.glance.LocalState

/** Records when a widget composition last reached the host, so the app can confirm a manual refresh. */
object WidgetHeartbeat {
    const val PREFS = "nedaa_widgets"
    const val KEY_LAST_RENDER = "widgetLastRenderedAt"

    fun stamp(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_LAST_RENDER, System.currentTimeMillis())
            .apply()
    }
}

/**
 * Stamps the heartbeat on every committed composition, which the session observes
 * just before publishing to the host. Reading LocalState is what keeps this out of
 * Compose's skipping path: Glance swaps that value on every update event, so a warm
 * session still invalidates this scope. LocalContext is static and would not.
 */
@Composable
fun WidgetRenderHeartbeat() {
    val context = LocalContext.current
    LocalState.current
    SideEffect { WidgetHeartbeat.stamp(context) }
}
