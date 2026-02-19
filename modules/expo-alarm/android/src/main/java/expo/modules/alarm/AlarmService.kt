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
        if (intent?.action == ACTION_STOP) {
            stopAlarm()
            return START_NOT_STICKY
        }

        if (intent?.action == ACTION_START) {
            val alarmId = intent.getStringExtra(EXTRA_ALARM_ID)
            if (alarmId != null) {
                val alarmType = intent.getStringExtra(EXTRA_ALARM_TYPE) ?: "custom"
                val title = intent.getStringExtra(EXTRA_ALARM_TITLE) ?: "Alarm"
                val soundName = intent.getStringExtra(EXTRA_SOUND_NAME) ?: "beep"
                startAlarm(alarmId, alarmType, title, soundName)
                return START_REDELIVER_INTENT
            }
        }

        // Null/unknown action: must still call startForeground to avoid crash,
        // then immediately stop
        val notificationManager = AlarmNotificationManager(this)
        val notification = notificationManager.buildAlarmNotification("", "", "Alarm")
        startForeground(AlarmNotificationManager.NOTIFICATION_ID, notification.build())
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        return START_NOT_STICKY
    }

    private fun startAlarm(alarmId: String, alarmType: String, title: String, soundName: String) {
        currentAlarmId = alarmId
        isRunning = true

        acquireWakeLock()

        val notificationManager = AlarmNotificationManager(this)
        val notification = notificationManager.buildAlarmNotification(alarmId, alarmType, title)
        startForeground(AlarmNotificationManager.NOTIFICATION_ID, notification.build())

        val db = AlarmDatabase.getInstance(this)
        val settings = db.getAlarmSettings(alarmType)

        val audioManager = AlarmAudioManager.getInstance(this)
        audioManager.saveSystemVolume()

        val sound = if (settings.sound.isNotEmpty()) settings.sound else soundName
        audioManager.startAlarmSound(sound, settings.volume)

        if (settings.vibrationEnabled) {
            audioManager.startVibration(settings.vibrationPattern)
        }

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

        currentAlarmId = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        isRunning = false
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
