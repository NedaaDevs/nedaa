package expo.modules.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class AthanReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "AthanReceiver"
        const val EXTRA_ATHAN_ID = "athan_id"
        const val EXTRA_PRAYER_ID = "prayer_id"
        const val EXTRA_SOUND_NAME = "sound_name"
        const val EXTRA_TITLE = "title"
        const val EXTRA_STOP_LABEL = "stop_label"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val athanId = intent.getStringExtra(EXTRA_ATHAN_ID) ?: return
        val prayerId = intent.getStringExtra(EXTRA_PRAYER_ID) ?: return
        val soundName = intent.getStringExtra(EXTRA_SOUND_NAME) ?: return
        val title = intent.getStringExtra(EXTRA_TITLE) ?: prayerId.replaceFirstChar { it.uppercase() }
        val stopLabel = intent.getStringExtra(EXTRA_STOP_LABEL) ?: "Stop"

        Log.d(TAG, "Received athan broadcast: prayer=$prayerId, sound=$soundName")
        AthanService.start(context, athanId, prayerId, soundName, title, stopLabel)
    }
}
