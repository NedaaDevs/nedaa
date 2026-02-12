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

        @Volatile
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

    // TEMP: Debug logging for settings feature - remove after verification
    private fun log(message: String) {
        AlarmLogger.getInstance(this).d("AlarmService", message)
    }

    private fun startAlarm(alarmId: String, alarmType: String, title: String, soundName: String) {
        currentAlarmId = alarmId
        isRunning = true

        acquireWakeLock()

        val notificationManager = AlarmNotificationManager(this)
        val notification = notificationManager.buildAlarmNotification(alarmId, alarmType, title)
        startForeground(AlarmNotificationManager.NOTIFICATION_ID, notification.build())

        // Read settings from database
        val db = AlarmDatabase.getInstance(this)
        val settings = db.getAlarmSettings(alarmType)

        // TEMP: Log settings being used
        log("TEMP: Alarm firing - type=$alarmType, id=$alarmId")
        log("TEMP: Settings from DB: sound=${settings.sound}, volume=${settings.volume}, vibrationEnabled=${settings.vibrationEnabled}, vibrationPattern=${settings.vibrationPattern}")

        val audioManager = AlarmAudioManager.getInstance(this)

        // Save system volume before alarm so we can restore after
        audioManager.saveSystemVolume()

        // Use sound from settings if available, otherwise use passed soundName
        val sound = if (settings.sound.isNotEmpty()) settings.sound else soundName
        log("TEMP: Using sound=$sound (settings.sound=${settings.sound}, fallback=$soundName)")
        audioManager.startAlarmSound(sound, settings.volume)

        // Use vibration settings
        if (settings.vibrationEnabled) {
            audioManager.startVibration(settings.vibrationPattern)
        } else {
            log("TEMP: Vibration disabled in settings, skipping")
        }

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
