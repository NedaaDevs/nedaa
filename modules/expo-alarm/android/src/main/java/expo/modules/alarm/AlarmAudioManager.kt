package expo.modules.alarm

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
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
    }

    private var mediaPlayer: MediaPlayer? = null
    private var systemRingtone: Ringtone? = null
    private var vibrator: Vibrator? = null
    private var isVibrating = false
    private var volume: Float = 1.0f
    private var savedSystemVolume: Int? = null

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

    // TEMP: Debug logging for settings feature - remove after verification
    private fun log(message: String) {
        AlarmLogger.getInstance(context).d("AlarmAudio", message)
    }

    @Synchronized
    fun saveSystemVolume() {
        // Only save if we don't already have a saved value (avoid overwriting original)
        if (savedSystemVolume != null) {
            log("TEMP: System volume already saved, skipping")
            return
        }
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        savedSystemVolume = am.getStreamVolume(AudioManager.STREAM_ALARM)
        log("TEMP: Saved system volume: $savedSystemVolume")
    }

    @Synchronized
    fun restoreSystemVolume() {
        savedSystemVolume?.let { vol ->
            try {
                val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
                am.setStreamVolume(AudioManager.STREAM_ALARM, vol, 0)
                log("TEMP: Restored system volume to: $vol")
            } catch (e: Exception) {
                log("TEMP: Failed to restore volume: ${e.message}")
            }
            savedSystemVolume = null
        } ?: log("TEMP: No saved volume to restore")
    }

    fun startAlarmSound(soundName: String): Boolean {
        return startAlarmSound(soundName, 1.0f)
    }

    @Synchronized
    fun startAlarmSound(soundName: String, volumeLevel: Float): Boolean {
        stopAlarmSound()
        log("TEMP: Starting alarm sound=$soundName volumeLevel=$volumeLevel")
        try {
            volume = volumeLevel.coerceIn(0f, 1f)

            // Set alarm stream volume based on setting (0.0-1.0 mapped to system range)
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM)
            val targetVol = (maxVol * volumeLevel).toInt().coerceIn(1, maxVol)
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, targetVol, 0)
            log("TEMP: Set system alarm volume to $targetVol/$maxVol (from setting $volumeLevel)")

            if (soundName.startsWith("content://")) {
                // System sound URI - use Ringtone API for better compatibility
                val uri = Uri.parse(soundName)
                systemRingtone = RingtoneManager.getRingtone(context, uri)?.apply {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        isLooping = true
                        volume = volumeLevel
                    }
                    play()
                }

                if (systemRingtone == null) {
                    log("TEMP: Failed to get Ringtone for URI: $soundName, falling back to default")
                    val defaultUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                    systemRingtone = RingtoneManager.getRingtone(context, defaultUri)?.apply {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            isLooping = true
                            volume = volumeLevel
                        }
                        play()
                    }
                }

                return systemRingtone != null
            } else {
                // Bundled resource - use MediaPlayer
                val resId = findSoundResource(soundName)
                if (resId == 0) {
                    log("TEMP: Sound resource not found: $soundName")
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
                    setVolume(volume, volume)
                    prepare()
                    start()
                }

                return true
            }
        } catch (e: Exception) {
            log("TEMP: Failed to start alarm sound: ${e.message}")
            mediaPlayer?.release()
            mediaPlayer = null
            systemRingtone?.stop()
            systemRingtone = null
            return false
        }
    }

    @Synchronized
    fun stopAlarmSound() {
        try {
            mediaPlayer?.let {
                if (it.isPlaying) it.stop()
                it.release()
            }
        } catch (_: Exception) {}
        mediaPlayer = null

        try {
            systemRingtone?.stop()
        } catch (_: Exception) {}
        systemRingtone = null
    }

    @Synchronized
    fun isPlaying(): Boolean {
        return try {
            mediaPlayer?.isPlaying == true || systemRingtone?.isPlaying == true
        } catch (_: Exception) {
            false
        }
    }

    @Synchronized
    fun setVolume(vol: Float) {
        volume = vol.coerceIn(0f, 1f)
        try {
            mediaPlayer?.setVolume(volume, volume)
        } catch (_: Exception) {}
    }

    fun getVolume(): Float = volume

    fun startVibration() {
        startVibration("default")
    }

    @Synchronized
    fun startVibration(patternName: String) {
        if (isVibrating) return
        isVibrating = true
        log("TEMP: Starting vibration with pattern=$patternName")
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
            log("TEMP: Failed to start vibration: ${e.message}")
            isVibrating = false
        }
    }

    @Synchronized
    fun stopVibration() {
        if (!isVibrating) return
        isVibrating = false
        try {
            getVibrator().cancel()
        } catch (_: Exception) {}
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
