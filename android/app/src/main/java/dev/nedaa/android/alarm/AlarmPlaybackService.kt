package dev.nedaa.android.alarm

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Binder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import org.json.JSONObject
import java.util.UUID

class AlarmPlaybackService : Service() {
    companion object {
        private const val TAG = "AlarmPlaybackService"

        @Volatile
        var isRunning = false
            private set
    }

    private val binder = LocalBinder()
    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val handler = Handler(Looper.getMainLooper())
    private var alarmView: AlarmOverlayView? = null
    private var windowManager: WindowManager? = null

    // Challenge verification
    private val challengeToken = UUID.randomUUID().toString()
    private var challengeCompleted = false

    // Activity heartbeat monitoring
    private var lastActivityAck = System.currentTimeMillis()
    private var activityBound = false

    // Alarm state
    private var currentAlarmType: String? = null
    private var currentAlarmTitle: String? = null
    private var currentAlarmBody: String? = null
    private var currentAlarmSubtitle: String? = null
    private var currentSoundUri: String? = null
    private var currentVibration: Boolean = true
    private var currentSnoozeMinutes: Int = 5
    private var currentChallengeType: String? = null
    private var currentMathDifficulty: String = "easy"
    private var currentMathQuestionCount: Int = 1
    private var currentTapCount: Int = 10
    private var currentChallengeGracePeriodSec: Int = 15
    private var currentTranslationsJson: String? = null

    inner class LocalBinder : Binder() {
        fun getService(): AlarmPlaybackService = this@AlarmPlaybackService
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service created")

        createNotificationChannel()
        acquireWakeLock()

        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }

        isRunning = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand: action=${intent?.action}")

        if (intent == null) {
            // Service restarted after kill - check persistent state
            Log.d(TAG, "Service restarted after kill")
            if (checkPersistentAlarmState()) {
                startForegroundWithNotification()
                launchAlarmActivity()
                return START_REDELIVER_INTENT
            }
            stopSelf()
            return START_NOT_STICKY
        }

        when (intent.action) {
            AlarmConstants.ACTION_START_ALARM -> {
                currentAlarmType = intent.getStringExtra(AlarmConstants.EXTRA_ALARM_TYPE) ?: "fajr"
                currentAlarmTitle = intent.getStringExtra(AlarmConstants.EXTRA_ALARM_TITLE) ?: "Prayer Alarm"
                currentAlarmBody = intent.getStringExtra(AlarmConstants.EXTRA_ALARM_BODY) ?: "Time to pray"
                currentAlarmSubtitle = intent.getStringExtra(AlarmConstants.EXTRA_ALARM_SUBTITLE)
                currentSoundUri = intent.getStringExtra(AlarmConstants.EXTRA_SOUND_URI)
                currentVibration = intent.getBooleanExtra(AlarmConstants.EXTRA_VIBRATION, true)
                currentSnoozeMinutes = intent.getIntExtra(AlarmConstants.EXTRA_SNOOZE_MINUTES, 5)
                currentChallengeType = intent.getStringExtra(AlarmConstants.EXTRA_CHALLENGE_TYPE)
                currentMathDifficulty = intent.getStringExtra(AlarmConstants.EXTRA_MATH_DIFFICULTY) ?: "easy"
                currentMathQuestionCount = intent.getIntExtra(AlarmConstants.EXTRA_MATH_QUESTION_COUNT, 1)
                currentTapCount = intent.getIntExtra(AlarmConstants.EXTRA_TAP_COUNT, 10)
                currentChallengeGracePeriodSec = intent.getIntExtra(AlarmConstants.EXTRA_CHALLENGE_GRACE_PERIOD_SEC, 15)
                currentTranslationsJson = intent.getStringExtra(AlarmConstants.EXTRA_TRANSLATIONS_JSON)

                savePersistentAlarmState()
                startForegroundWithNotification()
                startAlarmPlayback()
                launchAlarmActivity()
                startHeartbeatMonitor()
            }
            AlarmConstants.ACTION_STOP_ALARM -> {
                stopAlarm()
            }
            AlarmConstants.ACTION_SNOOZE_ALARM -> {
                snoozeAlarm()
            }
        }

        return START_REDELIVER_INTENT
    }

    override fun onBind(intent: Intent?): IBinder {
        activityBound = true
        lastActivityAck = System.currentTimeMillis()
        return binder
    }

    override fun onUnbind(intent: Intent?): Boolean {
        activityBound = false
        return true
    }

    override fun onRebind(intent: Intent?) {
        activityBound = true
        lastActivityAck = System.currentTimeMillis()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        Log.d(TAG, "Task removed - showing overlay")

        if (!challengeCompleted) {
            // User swiped app from recents - show overlay
            handler.postDelayed({
                if (!challengeCompleted && isRunning) {
                    showOverlay()
                }
            }, 300)
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "Service destroyed")
        isRunning = false
        removeOverlay()
        stopAlarmPlayback()
        releaseWakeLock()
        handler.removeCallbacksAndMessages(null)
        clearPersistentAlarmState()
        super.onDestroy()
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    fun getChallengeToken(): String = challengeToken

    fun acknowledgeHeartbeat() {
        lastActivityAck = System.currentTimeMillis()
    }

    fun verifyChallengeCompletion(token: String): Boolean {
        if (token != challengeToken) {
            Log.w(TAG, "Challenge verification failed - invalid token")
            return false
        }

        Log.d(TAG, "Challenge completed successfully")
        challengeCompleted = true
        stopAlarm()
        return true
    }

    // ==========================================
    // PRIVATE METHODS
    // ==========================================

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                AlarmConstants.CHANNEL_ID,
                AlarmConstants.CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Active alarm notification"
                setSound(null, null) // Sound handled by MediaPlayer
                enableVibration(false) // Vibration handled separately
                setBypassDnd(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun startForegroundWithNotification() {
        val notification = buildAlarmNotification()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceCompat.startForeground(
                this,
                AlarmConstants.NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            )
        } else {
            startForeground(AlarmConstants.NOTIFICATION_ID, notification)
        }
    }

    private fun buildAlarmNotification(): Notification {
        val fullScreenIntent = Intent(this, AlarmActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION
            putExtra(AlarmConstants.EXTRA_ALARM_TYPE, currentAlarmType)
            putExtra(AlarmConstants.EXTRA_CHALLENGE_TYPE, currentChallengeType)
        }

        val fullScreenPendingIntent = PendingIntent.getActivity(
            this, 0, fullScreenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val snoozeIntent = Intent(this, AlarmPlaybackService::class.java).apply {
            action = AlarmConstants.ACTION_SNOOZE_ALARM
        }
        val snoozePendingIntent = PendingIntent.getService(
            this, 2, snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val hasChallenge = !currentChallengeType.isNullOrEmpty() && currentChallengeType != "none"

        val builder = NotificationCompat.Builder(this, AlarmConstants.CHANNEL_ID)
            .setContentTitle(currentAlarmTitle)
            .setContentText(if (hasChallenge) "Complete challenge to dismiss" else currentAlarmBody)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setOngoing(true)
            .setAutoCancel(false)

        // Only add action buttons if there's no challenge
        // When challenge is enabled, user MUST complete it via the overlay
        if (!hasChallenge) {
            builder.addAction(android.R.drawable.ic_popup_sync, "Snooze", snoozePendingIntent)

            val dismissIntent = Intent(this, AlarmPlaybackService::class.java).apply {
                action = AlarmConstants.ACTION_STOP_ALARM
            }
            val dismissPendingIntent = PendingIntent.getService(
                this, 1, dismissIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Dismiss", dismissPendingIntent)
        }

        return builder.build()
    }

    private fun startAlarmPlayback() {
        Log.d(TAG, "Starting alarm playback")

        // Start sound
        try {
            val soundUri = if (!currentSoundUri.isNullOrEmpty()) {
                Uri.parse(currentSoundUri)
            } else {
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            }

            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(this@AlarmPlaybackService, soundUri)
                isLooping = true
                prepare()
                start()
            }
            Log.d(TAG, "Sound playback started")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start sound playback", e)
        }

        // Start vibration
        if (currentVibration) {
            startVibration()
        }
    }

    private fun startVibration() {
        val pattern = longArrayOf(0, 500, 500)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(pattern, 0)
        }
    }

    private fun stopAlarmPlayback() {
        Log.d(TAG, "Stopping alarm playback")

        mediaPlayer?.apply {
            if (isPlaying) stop()
            release()
        }
        mediaPlayer = null

        vibrator?.cancel()
    }

    private fun pauseAlarmPlayback() {
        Log.d(TAG, "Pausing alarm playback")
        mediaPlayer?.let {
            if (it.isPlaying) {
                it.pause()
            }
        }
        vibrator?.cancel()
    }

    private fun resumeAlarmPlayback() {
        Log.d(TAG, "Resuming alarm playback")
        mediaPlayer?.let {
            if (!it.isPlaying) {
                it.start()
            }
        }
        if (currentVibration) {
            startVibration()
        }
    }

    private fun launchAlarmActivity() {
        Log.d(TAG, "Launching alarm UI")

        // Check if we can use overlay
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(this)) {
            showOverlay()
        } else {
            // Fallback to activity (may not work when app is killed)
            val intent = Intent(this, AlarmActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_NO_USER_ACTION
                putExtra(AlarmConstants.EXTRA_ALARM_TYPE, currentAlarmType)
                putExtra(AlarmConstants.EXTRA_CHALLENGE_TYPE, currentChallengeType)
            }
            try {
                startActivity(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start activity", e)
            }
        }
    }

    private fun showOverlay() {
        if (alarmView != null) {
            Log.d(TAG, "Overlay already showing")
            return
        }

        Log.d(TAG, "Showing overlay")

        handler.post {
            try {
                windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager

                // Parse translations using helper
                val translations = AlarmTranslations.fromJson(currentTranslationsJson)

                Log.d(TAG, "Creating overlay with challengeType=$currentChallengeType, mathDifficulty=$currentMathDifficulty, mathQuestionCount=$currentMathQuestionCount, tapCount=$currentTapCount, gracePeriod=$currentChallengeGracePeriodSec")
                alarmView = AlarmOverlayView(
                    context = this,
                    alarmType = currentAlarmType ?: "fajr",
                    alarmSubtitle = currentAlarmSubtitle,
                    challengeType = currentChallengeType,
                    snoozeMinutes = currentSnoozeMinutes,
                    mathDifficulty = currentMathDifficulty,
                    mathQuestionCount = currentMathQuestionCount,
                    tapCount = currentTapCount,
                    challengeGracePeriodSec = currentChallengeGracePeriodSec,
                    translations = translations,
                    onDismiss = {
                        Log.d(TAG, "Overlay onDismiss called")
                        challengeCompleted = true
                        stopAlarm()
                    },
                    onSnooze = {
                        Log.d(TAG, "Overlay onSnooze called")
                        snoozeAlarm()
                    },
                    onChallengeStarted = {
                        Log.d(TAG, "Challenge started - pausing audio")
                        pauseAlarmPlayback()
                    },
                    onGracePeriodEnded = {
                        Log.d(TAG, "Grace period ended - resuming audio")
                        resumeAlarmPlayback()
                    }
                )

                val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                } else {
                    @Suppress("DEPRECATION")
                    WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
                }

                val params = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT,
                    layoutType,
                    WindowManager.LayoutParams.FLAG_FULLSCREEN or
                            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
                    PixelFormat.OPAQUE
                )
                params.gravity = Gravity.CENTER

                windowManager?.addView(alarmView, params)
                Log.d(TAG, "Overlay added successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to show overlay", e)
                alarmView = null
            }
        }
    }

    private fun removeOverlay() {
        handler.post {
            alarmView?.let { view ->
                try {
                    view.cleanup()
                    windowManager?.removeView(view)
                    Log.d(TAG, "Overlay removed")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to remove overlay", e)
                }
            }
            alarmView = null
        }
    }

    private fun startHeartbeatMonitor() {
        handler.postDelayed(heartbeatRunnable, AlarmConstants.HEARTBEAT_INTERVAL_MS)
    }

    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            if (challengeCompleted) return

            // If overlay is not showing, show it
            if (alarmView == null) {
                Log.d(TAG, "Overlay not showing - relaunching")
                launchAlarmActivity()
            }

            handler.postDelayed(this, AlarmConstants.HEARTBEAT_INTERVAL_MS)
        }
    }

    private fun stopAlarm() {
        Log.d(TAG, "Stopping alarm")
        challengeCompleted = true
        clearPersistentAlarmState()
        removeOverlay()
        stopAlarmPlayback()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun snoozeAlarm() {
        Log.d(TAG, "Snoozing alarm for $currentSnoozeMinutes minutes")

        // Schedule snooze alarm
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val snoozeTime = System.currentTimeMillis() + (currentSnoozeMinutes * 60 * 1000)

        val snoozeIntent = Intent(this, AlarmReceiver::class.java).apply {
            action = AlarmConstants.ACTION_START_ALARM
            putExtra(AlarmConstants.EXTRA_ALARM_TYPE, currentAlarmType)
            putExtra(AlarmConstants.EXTRA_ALARM_TITLE, currentAlarmTitle)
            putExtra(AlarmConstants.EXTRA_ALARM_BODY, currentAlarmBody)
            putExtra(AlarmConstants.EXTRA_SOUND_URI, currentSoundUri)
            putExtra(AlarmConstants.EXTRA_VIBRATION, currentVibration)
            putExtra(AlarmConstants.EXTRA_SNOOZE_MINUTES, currentSnoozeMinutes)
            putExtra(AlarmConstants.EXTRA_CHALLENGE_TYPE, currentChallengeType)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            this,
            (System.currentTimeMillis() % Int.MAX_VALUE).toInt(),
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (alarmManager.canScheduleExactAlarms()) {
                alarmManager.setAlarmClock(
                    AlarmManager.AlarmClockInfo(snoozeTime, pendingIntent),
                    pendingIntent
                )
            }
        } else {
            alarmManager.setAlarmClock(
                AlarmManager.AlarmClockInfo(snoozeTime, pendingIntent),
                pendingIntent
            )
        }

        stopAlarm()
    }

    private fun acquireWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "Nedaa:AlarmPlaybackWakeLock"
        ).apply {
            acquire(10 * 60 * 1000L) // 10 minutes max
        }
    }

    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        wakeLock = null
    }

    private fun savePersistentAlarmState() {
        getSharedPreferences(AlarmConstants.PREFS_ALARM_STATE, Context.MODE_PRIVATE).edit().apply {
            putBoolean(AlarmConstants.PREF_KEY_ALARM_ACTIVE, true)
            putString(AlarmConstants.EXTRA_ALARM_TYPE, currentAlarmType)
            putString(AlarmConstants.EXTRA_ALARM_TITLE, currentAlarmTitle)
            putString(AlarmConstants.EXTRA_ALARM_BODY, currentAlarmBody)
            putString(AlarmConstants.EXTRA_ALARM_SUBTITLE, currentAlarmSubtitle)
            putString(AlarmConstants.EXTRA_SOUND_URI, currentSoundUri)
            putBoolean(AlarmConstants.EXTRA_VIBRATION, currentVibration)
            putInt(AlarmConstants.EXTRA_SNOOZE_MINUTES, currentSnoozeMinutes)
            putString(AlarmConstants.EXTRA_CHALLENGE_TYPE, currentChallengeType)
            putString(AlarmConstants.EXTRA_MATH_DIFFICULTY, currentMathDifficulty)
            putInt(AlarmConstants.EXTRA_MATH_QUESTION_COUNT, currentMathQuestionCount)
            putInt(AlarmConstants.EXTRA_TAP_COUNT, currentTapCount)
            putInt(AlarmConstants.EXTRA_CHALLENGE_GRACE_PERIOD_SEC, currentChallengeGracePeriodSec)
            putString(AlarmConstants.EXTRA_TRANSLATIONS_JSON, currentTranslationsJson)
            apply()
        }
    }

    private fun checkPersistentAlarmState(): Boolean {
        val prefs = getSharedPreferences(AlarmConstants.PREFS_ALARM_STATE, Context.MODE_PRIVATE)
        val active = prefs.getBoolean(AlarmConstants.PREF_KEY_ALARM_ACTIVE, false)

        if (active) {
            currentAlarmType = prefs.getString(AlarmConstants.EXTRA_ALARM_TYPE, AlarmConstants.Defaults.ALARM_TYPE)
            currentAlarmTitle = prefs.getString(AlarmConstants.EXTRA_ALARM_TITLE, AlarmConstants.Defaults.ALARM_TITLE)
            currentAlarmBody = prefs.getString(AlarmConstants.EXTRA_ALARM_BODY, AlarmConstants.Defaults.ALARM_BODY)
            currentAlarmSubtitle = prefs.getString(AlarmConstants.EXTRA_ALARM_SUBTITLE, null)
            currentSoundUri = prefs.getString(AlarmConstants.EXTRA_SOUND_URI, null)
            currentVibration = prefs.getBoolean(AlarmConstants.EXTRA_VIBRATION, AlarmConstants.Defaults.VIBRATION_ENABLED)
            currentSnoozeMinutes = prefs.getInt(AlarmConstants.EXTRA_SNOOZE_MINUTES, AlarmConstants.Defaults.SNOOZE_MINUTES)
            currentChallengeType = prefs.getString(AlarmConstants.EXTRA_CHALLENGE_TYPE, null)
            currentMathDifficulty = prefs.getString(AlarmConstants.EXTRA_MATH_DIFFICULTY, AlarmConstants.Defaults.MATH_DIFFICULTY) ?: AlarmConstants.Defaults.MATH_DIFFICULTY
            currentMathQuestionCount = prefs.getInt(AlarmConstants.EXTRA_MATH_QUESTION_COUNT, AlarmConstants.Defaults.MATH_QUESTION_COUNT)
            currentTapCount = prefs.getInt(AlarmConstants.EXTRA_TAP_COUNT, AlarmConstants.Defaults.TAP_COUNT)
            currentChallengeGracePeriodSec = prefs.getInt(AlarmConstants.EXTRA_CHALLENGE_GRACE_PERIOD_SEC, AlarmConstants.Defaults.CHALLENGE_GRACE_PERIOD_SEC)
            currentTranslationsJson = prefs.getString(AlarmConstants.EXTRA_TRANSLATIONS_JSON, null)
        }

        return active
    }

    private fun clearPersistentAlarmState() {
        getSharedPreferences(AlarmConstants.PREFS_ALARM_STATE, Context.MODE_PRIVATE).edit().apply {
            putBoolean(AlarmConstants.PREF_KEY_ALARM_ACTIVE, false)
            apply()
        }
    }
}
