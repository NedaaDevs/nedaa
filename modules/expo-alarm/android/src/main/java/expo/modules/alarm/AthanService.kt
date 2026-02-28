package expo.modules.alarm

import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log

class AthanService : Service() {

    companion object {
        private const val TAG = "AthanService"
        private const val WAKE_LOCK_TAG = "nedaa:athan_wake_lock"
        private const val WAKE_LOCK_TIMEOUT_MS = 5L * 60 * 1000 // 5 minutes

        const val ACTION_START = "expo.modules.alarm.ACTION_ATHAN_START"
        const val ACTION_STOP = "expo.modules.alarm.ACTION_ATHAN_STOP"
        const val EXTRA_ATHAN_ID = "athan_id"
        const val EXTRA_PRAYER_ID = "prayer_id"
        const val EXTRA_SOUND_NAME = "sound_name"
        const val EXTRA_TITLE = "title"
        const val EXTRA_STOP_LABEL = "stop_label"

        @Volatile
        var isRunning = false
            private set

        fun start(context: Context, athanId: String, prayerId: String, soundName: String, title: String, stopLabel: String) {
            val intent = Intent(context, AthanService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_ATHAN_ID, athanId)
                putExtra(EXTRA_PRAYER_ID, prayerId)
                putExtra(EXTRA_SOUND_NAME, soundName)
                putExtra(EXTRA_TITLE, title)
                putExtra(EXTRA_STOP_LABEL, stopLabel)
            }
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            if (!isRunning) return
            val intent = Intent(context, AthanService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private var mediaPlayer: MediaPlayer? = null
    private var currentAthanId: String? = null
    private var audioFocusRequest: AudioFocusRequest? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val athanId = intent.getStringExtra(EXTRA_ATHAN_ID) ?: return START_NOT_STICKY
                val prayerId = intent.getStringExtra(EXTRA_PRAYER_ID) ?: return START_NOT_STICKY
                val soundName = intent.getStringExtra(EXTRA_SOUND_NAME) ?: return START_NOT_STICKY
                val title = intent.getStringExtra(EXTRA_TITLE) ?: prayerId.replaceFirstChar { it.uppercase() }
                val stopLabel = intent.getStringExtra(EXTRA_STOP_LABEL) ?: "Stop"
                startAthan(athanId, soundName, title, stopLabel)
            }
            ACTION_STOP -> stopAthan()
        }
        return START_NOT_STICKY
    }

    private fun startAthan(athanId: String, soundName: String, title: String, stopLabel: String) {
        Log.d(TAG, "Starting athan: title=$title, sound=$soundName")
        if (isRunning) {
            Log.d(TAG, "Already playing, stopping current playback first")
            stopPlayback()
        }

        currentAthanId = athanId
        isRunning = true
        acquireWakeLock()

        val notificationManager = AthanNotificationManager(this)
        val notification = notificationManager.buildAthanNotification(title, stopLabel)
        startForeground(AthanNotificationManager.NOTIFICATION_ID, notification.build())

        try {
            if (soundName.startsWith("content://")) {
                startFromUri(Uri.parse(soundName))
            } else {
                startFromResource(soundName)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start athan playback: ${e.message}")
            stopAthan()
        }
    }

    private fun startFromResource(soundName: String) {
        val cleanName = soundName.replace(Regex("\\.(ogg|mp3|wav|m4a|caf)$"), "")
        val resId = resources.getIdentifier(cleanName, "raw", packageName)
        if (resId == 0) {
            stopAthan()
            return
        }

        val uri = Uri.parse("android.resource://$packageName/$resId")
        createAndStartPlayer(uri)
    }

    private fun startFromUri(uri: Uri) {
        createAndStartPlayer(uri)
    }

    private fun requestAudioFocus(): Boolean {
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()

        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(attrs)
            .setOnAudioFocusChangeListener { focusChange ->
                Log.d(TAG, "Audio focus changed: $focusChange")
            }
            .build()

        audioFocusRequest = request
        val result = audioManager.requestAudioFocus(request)
        Log.d(TAG, "Audio focus request result: $result")
        return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    private fun abandonAudioFocus() {
        audioFocusRequest?.let {
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioManager.abandonAudioFocusRequest(it)
        }
        audioFocusRequest = null
    }

    private fun createAndStartPlayer(uri: Uri) {
        val focusGranted = requestAudioFocus()
        Log.d(TAG, "Audio focus granted: $focusGranted, proceeding with USAGE_MEDIA")

        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()

        mediaPlayer = MediaPlayer().apply {
            setAudioAttributes(attrs)
            setDataSource(this@AthanService, uri)
            isLooping = false
            setOnCompletionListener {
                Log.d(TAG, "Playback completed naturally")
                stopAthan()
            }
            setOnErrorListener { _, what, extra ->
                Log.e(TAG, "MediaPlayer error: what=$what, extra=$extra")
                stopAthan()
                true
            }
            setOnPreparedListener { mp ->
                Log.d(TAG, "MediaPlayer prepared, duration=${mp.duration}ms, starting playback")
                mp.start()
            }
            prepareAsync()
        }
    }

    private fun stopPlayback() {
        try {
            mediaPlayer?.let {
                if (it.isPlaying) it.stop()
                it.release()
            }
        } catch (_: Exception) {}
        mediaPlayer = null
    }

    private fun stopAthan() {
        Log.d(TAG, "Stopping athan service")
        stopPlayback()
        abandonAudioFocus()
        AthanNotificationManager(this).cancelNotification()
        releaseWakeLock()
        isRunning = false
        currentAthanId = null
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
            wakeLock?.let { if (it.isHeld) it.release() }
        } catch (_: Exception) {}
        wakeLock = null
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isRunning) {
            stopPlayback()
            abandonAudioFocus()
            releaseWakeLock()
            isRunning = false
        }
    }
}
