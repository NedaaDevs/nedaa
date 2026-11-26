package expo.modules.alarm

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager

class AlarmService : Service() {

    companion object {
        private const val WAKE_LOCK_TAG = "nedaa:alarm_wake_lock"

        const val ACTION_START = "expo.modules.alarm.ACTION_START"
        const val ACTION_STOP = "expo.modules.alarm.ACTION_STOP"
        const val EXTRA_ALARM_ID = "alarm_id"
        const val EXTRA_ALARM_TYPE = "alarm_type"
        const val EXTRA_ALARM_TITLE = "alarm_title"
        const val EXTRA_SOUND_NAME = "sound_name"

        @Volatile
        var isRunning = false
            private set

        // The alarm being rung, null when silent; changes with isRunning.
        @Volatile
        var ringingAlarmId: String? = null
            private set

        fun start(context: Context, alarmId: String, alarmType: String, title: String, soundName: String) {
            val intent = Intent(context, AlarmService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_ALARM_ID, alarmId)
                putExtra(EXTRA_ALARM_TYPE, alarmType)
                putExtra(EXTRA_ALARM_TITLE, title)
                putExtra(EXTRA_SOUND_NAME, soundName)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, AlarmService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopAlarm()
            return START_NOT_STICKY
        }

        if (intent?.action == ACTION_START) {
            val alarmId = intent.getStringExtra(EXTRA_ALARM_ID)
            val record = alarmId?.let { AlarmDatabase.getInstance(this).getAlarm(it) }
            val redelivered = flags and START_FLAG_REDELIVERY != 0
            val action = RedeliveredStart.actionFor(redelivered, RedeliveredStart.isEnded(record?.completed), isRunning)
            if (alarmId != null && action != RedeliveredStart.Action.RING) {
                AlarmLogger.getInstance(this).w("AlarmService", "Skipping ended alarm: id=$alarmId")
                if (action == RedeliveredStart.Action.SKIP_AND_STOP_THIS_START) endSkippedStart(startId)
                return START_NOT_STICKY
            } else if (alarmId != null) {
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

    // The foreground start the system requires, then this start alone ends.
    private fun endSkippedStart(startId: Int) {
        val notification = AlarmNotificationManager(this).buildSilentStartNotification()
        startForeground(AlarmNotificationManager.NOTIFICATION_ID, notification)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf(startId)
    }

    private fun startAlarm(alarmId: String, alarmType: String, title: String, soundName: String) {
        ringingAlarmId = alarmId
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
        audioManager.startAlarmSound(
            sound,
            settings.volume,
            settings.gentleWakeUpEnabled,
            settings.gentleWakeUpDuration
        )

        if (settings.vibrationEnabled) {
            audioManager.startVibration(settings.vibrationPattern)
        }

        AlarmLogger.getInstance(this).d("AlarmService", "Alarm ringing: id=$alarmId type=$alarmType sound=$sound")

        if (AlarmOverlayService.usesNativeOverlay(this)) {
            AlarmOverlayService.start(this, alarmId, alarmType, title)
        } else {
            AlarmLogger.getInstance(this).w("AlarmService", "Overlay permission missing — skipping full-screen challenge overlay for id=$alarmId type=$alarmType")
        }
    }

    private fun stopAlarm() {
        AlarmOverlayService.stopRinging(this)

        val audioManager = AlarmAudioManager.getInstance(this)
        audioManager.stopAll()

        AlarmNotificationManager(this).cancelNotification()
        releaseWakeLock()

        ringingAlarmId = null
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
                // Held for the whole ring; stopAlarm and onDestroy release it.
                // A sleeping CPU would stall the overlay's grace timer.
                @Suppress("WakelockTimeout")
                acquire()
            }
        }
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.let {
                if (it.isHeld) it.release()
            }
        } catch (e: Exception) {
            AlarmLogger.getInstance(this).d("AlarmService", "releaseWakeLock failed: ${e.message}")
        }
        wakeLock = null
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // Covers alarms with no overlay permission, where this service is the only one alive.
        ringingAlarmId?.let { AlarmScheduler(this).rearmUnsolvedAlarm(it) }
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isRunning) {
            AlarmAudioManager.getInstance(this).stopAll()
            ringingAlarmId = null
            isRunning = false
        }
        releaseWakeLock()
    }
}
