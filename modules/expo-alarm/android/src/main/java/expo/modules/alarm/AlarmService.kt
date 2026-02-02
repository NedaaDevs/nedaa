package expo.modules.alarm

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.os.PowerManager
import android.provider.Settings

class AlarmService : Service() {

    companion object {
        private const val WAKE_LOCK_TAG = "nedaa:alarm_wake_lock"
        private const val WAKE_LOCK_TIMEOUT_MS = 10L * 60 * 1000 // 10 minutes

        const val ACTION_START = "expo.modules.alarm.ACTION_START"
        const val ACTION_STOP = "expo.modules.alarm.ACTION_STOP"
        const val EXTRA_ALARM_ID = "alarm_id"
        const val EXTRA_ALARM_TYPE = "alarm_type"
        const val EXTRA_ALARM_TITLE = "alarm_title"
        const val EXTRA_SOUND_NAME = "sound_name"

        var isRunning = false
            private set

        fun start(context: Context, alarmId: String, alarmType: String, title: String, soundName: String) {
            val intent = Intent(context, AlarmService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_ALARM_ID, alarmId)
                putExtra(EXTRA_ALARM_TYPE, alarmType)
                putExtra(EXTRA_ALARM_TITLE, title)
                putExtra(EXTRA_SOUND_NAME, soundName)
            }
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, AlarmService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private var currentAlarmId: String? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val alarmId = intent.getStringExtra(EXTRA_ALARM_ID) ?: return START_NOT_STICKY
                val alarmType = intent.getStringExtra(EXTRA_ALARM_TYPE) ?: "custom"
                val title = intent.getStringExtra(EXTRA_ALARM_TITLE) ?: "Alarm"
                val soundName = intent.getStringExtra(EXTRA_SOUND_NAME) ?: "beep"
                startAlarm(alarmId, alarmType, title, soundName)
            }
            ACTION_STOP -> stopAlarm()
        }
        return START_REDELIVER_INTENT
    }

    private fun startAlarm(alarmId: String, alarmType: String, title: String, soundName: String) {
        currentAlarmId = alarmId
        isRunning = true

        acquireWakeLock()

        val notificationManager = AlarmNotificationManager(this)
        val notification = notificationManager.buildAlarmNotification(alarmId, alarmType, title)
        startForeground(AlarmNotificationManager.NOTIFICATION_ID, notification.build())

        val audioManager = AlarmAudioManager.getInstance(this)
        audioManager.startAlarmSound(soundName)
        audioManager.startVibration()

        // Start overlay service for bypass prevention (if permission granted)
        if (Settings.canDrawOverlays(this)) {
            AlarmOverlayService.start(this, alarmId, alarmType, title)
        }
    }

    private fun stopAlarm() {
        AlarmOverlayService.stop(this)

        val audioManager = AlarmAudioManager.getInstance(this)
        audioManager.stopAll()

        AlarmNotificationManager(this).cancelNotification()
        releaseWakeLock()

        isRunning = false
        currentAlarmId = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                WAKE_LOCK_TAG
            ).apply {
                acquire(WAKE_LOCK_TIMEOUT_MS)
            }
        }
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.let {
                if (it.isHeld) it.release()
            }
        } catch (_: Exception) {}
        wakeLock = null
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isRunning) {
            AlarmAudioManager.getInstance(this).stopAll()
            releaseWakeLock()
            isRunning = false
        }
    }
}
