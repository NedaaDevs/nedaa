package expo.modules.alarm

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

class AlarmAudioManager(private val context: Context) {

    companion object {
        @Volatile
        private var instance: AlarmAudioManager? = null

        fun getInstance(context: Context): AlarmAudioManager {
            return instance ?: synchronized(this) {
                instance ?: AlarmAudioManager(context.applicationContext).also { instance = it }
            }
        }

        // Gentle wake-up: ramp playback attenuation from this fraction of the target
        // up to the target over the configured duration, one step per interval.
        private const val RAMP_START_FRACTION = 0.2f
        private const val RAMP_STEP_INTERVAL_MS = 1000L
    }

    private var mediaPlayer: MediaPlayer? = null
    private var systemRingtone: Ringtone? = null
    private var vibrator: Vibrator? = null
    private var isVibrating = false
    private var volume: Float = 1.0f
    private var savedSystemVolume: Int? = null

    // Gentle wake-up ramp runs on the service (main) thread via this Handler.
    private val rampHandler = Handler(Looper.getMainLooper())
    private var rampRunnable: Runnable? = null
    private var rampGeneration = 0

    private fun getVibrator(): Vibrator {
        vibrator?.let { return it }
        val v = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            manager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        vibrator = v
        return v
    }

    private fun log(message: String) {
        AlarmLogger.getInstance(context).d("AlarmAudio", message)
    }

    private val prefs = context.getSharedPreferences("alarm_audio_prefs", Context.MODE_PRIVATE)
    private val PREF_SAVED_VOLUME = "saved_system_volume"

    @Synchronized
    fun saveSystemVolume() {
        if (savedSystemVolume != null) return
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        savedSystemVolume = am.getStreamVolume(AudioManager.STREAM_ALARM)
        prefs.edit().putInt(PREF_SAVED_VOLUME, savedSystemVolume!!).apply()
        log("Saved system volume: $savedSystemVolume")
    }

    @Synchronized
    fun restoreSystemVolume() {
        val vol = savedSystemVolume ?: prefs.getInt(PREF_SAVED_VOLUME, -1).takeIf { it >= 0 }
        if (vol != null) {
            try {
                val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
                am.setStreamVolume(AudioManager.STREAM_ALARM, vol, 0)
                log("Restored system volume to: $vol")
            } catch (e: Exception) {
                log("Failed to restore volume: ${e.message}")
            }
        }
        savedSystemVolume = null
        prefs.edit().remove(PREF_SAVED_VOLUME).apply()
    }

    fun startAlarmSound(soundName: String): Boolean {
        return startAlarmSound(soundName, 1.0f, false, 0)
    }

    fun startAlarmSound(soundName: String, volumeLevel: Float): Boolean {
        return startAlarmSound(soundName, volumeLevel, false, 0)
    }

    @Synchronized
    fun startAlarmSound(
        soundName: String,
        volumeLevel: Float,
        gentleWakeUpEnabled: Boolean,
        gentleWakeUpDurationMinutes: Int
    ): Boolean {
        stopAlarmSound()
        log("Starting alarm sound=$soundName volumeLevel=$volumeLevel gentle=$gentleWakeUpEnabled/${gentleWakeUpDurationMinutes}min")
        try {
            volume = volumeLevel.coerceIn(0f, 1f)

            // Set alarm stream volume based on setting (0.0-1.0 mapped to system range).
            // The gentle ramp modulates per-player attenuation only, never this stream,
            // so it never fights saveSystemVolume/restoreSystemVolume.
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM)
            val targetVol = (maxVol * volumeLevel).toInt().coerceIn(1, maxVol)
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, targetVol, 0)
            log("Set system alarm volume to $targetVol/$maxVol (from setting $volumeLevel)")

            val gentleActive = gentleWakeUpEnabled && gentleWakeUpDurationMinutes > 0
            val startVolume = if (gentleActive) volume * RAMP_START_FRACTION else volume

            if (soundName.startsWith("content://")) {
                // System sound URI - use Ringtone API for better compatibility
                val uri = Uri.parse(soundName)
                systemRingtone = RingtoneManager.getRingtone(context, uri)?.apply {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        isLooping = true
                        volume = startVolume
                    }
                    play()
                }

                if (systemRingtone == null) {
                    log("Failed to get Ringtone for URI: $soundName, falling back to default")
                    val defaultUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    systemRingtone = RingtoneManager.getRingtone(context, defaultUri)?.apply {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            isLooping = true
                            volume = startVolume
                        }
                        play()
                    }
                }

                if (systemRingtone != null && gentleActive) {
                    startVolumeRamp(volume, gentleWakeUpDurationMinutes)
                }
                return systemRingtone != null
            } else {
                // Bundled resource - use MediaPlayer
                val resId = findSoundResource(soundName)
                if (resId == 0) {
                    log("Sound resource not found: $soundName")
                    return false
                }
                val uri = Uri.parse("android.resource://${context.packageName}/$resId")

                mediaPlayer = MediaPlayer().apply {
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    setDataSource(context, uri)
                    isLooping = true
                    setVolume(startVolume, startVolume)
                    setOnPreparedListener { mp ->
                        mp.start()
                        log("MediaPlayer prepared and started")
                    }
                    setOnErrorListener { _, what, extra ->
                        log("MediaPlayer error: what=$what extra=$extra")
                        false
                    }
                    prepareAsync()
                }

                if (gentleActive) {
                    startVolumeRamp(volume, gentleWakeUpDurationMinutes)
                }
                return true
            }
        } catch (e: Exception) {
            log("Failed to start alarm sound: ${e.message}")
            cancelVolumeRamp()
            mediaPlayer?.release()
            mediaPlayer = null
            systemRingtone?.stop()
            systemRingtone = null
            return false
        }
    }

    // Steps the per-player attenuation from RAMP_START_FRACTION*target up to target,
    // one step per RAMP_STEP_INTERVAL_MS, over the given duration. A generation token
    // makes any step that survives a cancel a no-op, so nothing fires after stop.
    private fun startVolumeRamp(targetAtten: Float, durationMinutes: Int) {
        cancelVolumeRamp()
        val durationMs = durationMinutes * 60_000L
        val totalSteps = (durationMs / RAMP_STEP_INTERVAL_MS).toInt().coerceAtLeast(1)
        val startAtten = targetAtten * RAMP_START_FRACTION
        val generation = ++rampGeneration
        var step = 0
        log("Gentle wake-up ramp $startAtten -> $targetAtten over ${durationMinutes}min ($totalSteps steps)")
        rampRunnable = object : Runnable {
            override fun run() {
                if (generation != rampGeneration) return
                step++
                val fraction = (step.toFloat() / totalSteps).coerceAtMost(1f)
                applyPlaybackVolume(startAtten + (targetAtten - startAtten) * fraction)
                if (fraction < 1f) {
                    rampHandler.postDelayed(this, RAMP_STEP_INTERVAL_MS)
                } else {
                    rampRunnable = null
                    log("Gentle wake-up ramp complete at $targetAtten")
                }
            }
        }
        rampHandler.postDelayed(rampRunnable!!, RAMP_STEP_INTERVAL_MS)
    }

    private fun cancelVolumeRamp() {
        rampGeneration++
        rampRunnable?.let { rampHandler.removeCallbacks(it) }
        rampRunnable = null
    }

    // Applies attenuation to whichever player is active. Does not touch the `volume`
    // field (the ramp target) or the STREAM_ALARM system volume.
    private fun applyPlaybackVolume(atten: Float) {
        val v = atten.coerceIn(0f, 1f)
        try {
            mediaPlayer?.setVolume(v, v)
        } catch (e: Exception) {
            log("applyPlaybackVolume mediaPlayer failed: ${e.message}")
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                systemRingtone?.volume = v
            } catch (e: Exception) {
                log("applyPlaybackVolume ringtone failed: ${e.message}")
            }
        }
    }

    @Synchronized
    fun stopAlarmSound() {
        cancelVolumeRamp()
        try {
            mediaPlayer?.let {
                if (it.isPlaying) it.stop()
                it.release()
            }
        } catch (_: Exception) {}
        mediaPlayer = null

        try {
            systemRingtone?.stop()
        } catch (e: Exception) {
            AlarmLogger.getInstance(context).d("AlarmAudio", "stopAlarmSound ringtone failed: ${e.message}")
        }
        systemRingtone = null
    }

    @Synchronized
    fun isPlaying(): Boolean {
        return try {
            mediaPlayer?.isPlaying == true || systemRingtone?.isPlaying == true
        } catch (e: Exception) {
            AlarmLogger.getInstance(context).d("AlarmAudio", "isPlaying check failed: ${e.message}")
            false
        }
    }

    @Synchronized
    fun setVolume(vol: Float) {
        volume = vol.coerceIn(0f, 1f)
        try {
            mediaPlayer?.setVolume(volume, volume)
        } catch (e: Exception) {
            AlarmLogger.getInstance(context).d("AlarmAudio", "setVolume failed: ${e.message}")
        }
    }

    fun getVolume(): Float = volume

    fun startVibration() {
        startVibration("default")
    }

    @Synchronized
    fun startVibration(patternName: String) {
        if (isVibrating) return
        isVibrating = true
        log("Starting vibration with pattern=$patternName")
        try {
            val vib = getVibrator()
            val pattern = when (patternName) {
                "gentle" -> longArrayOf(0, 200, 800, 200, 800, 200, 800)
                "aggressive" -> longArrayOf(0, 100, 100, 100, 100, 100, 100, 100, 100)
                else -> longArrayOf(0, 800, 200, 800, 200, 800, 200, 800) // default
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vib.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vib.vibrate(pattern, 0)
            }
        } catch (e: Exception) {
            log("Failed to start vibration: ${e.message}")
            isVibrating = false
        }
    }

    @Synchronized
    fun stopVibration() {
        if (!isVibrating) return
        isVibrating = false
        try {
            getVibrator().cancel()
        } catch (e: Exception) {
            AlarmLogger.getInstance(context).d("AlarmAudio", "stopVibration failed: ${e.message}")
        }
    }

    @Synchronized
    fun stopAll() {
        stopAlarmSound()
        stopVibration()
        restoreSystemVolume()
    }

    private fun findSoundResource(name: String): Int {
        val cleanName = name.replace(Regex("\\.(ogg|mp3|wav|m4a|caf)$"), "")
        val resId = context.resources.getIdentifier(cleanName, "raw", context.packageName)
        if (resId != 0) return resId
        // Fallback to beep
        return context.resources.getIdentifier("beep", "raw", context.packageName)
    }
}
