package dev.nedaa.android.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class AlarmReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "AlarmReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "Alarm received: action=${intent.action}")

        when (intent.action) {
            AlarmConstants.ACTION_START_ALARM,
            Intent.ACTION_BOOT_COMPLETED,
            "android.intent.action.LOCKED_BOOT_COMPLETED" -> {
                startAlarmService(context, intent)
            }
        }
    }

    private fun startAlarmService(context: Context, intent: Intent) {
        val serviceIntent = Intent(context, AlarmPlaybackService::class.java).apply {
            action = AlarmConstants.ACTION_START_ALARM
        }

        // Copy all alarm configuration from received intent
        AlarmIntentHelper.copyExtras(intent, serviceIntent)

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            Log.d(TAG, "Alarm service started")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start alarm service", e)
        }
    }
}
