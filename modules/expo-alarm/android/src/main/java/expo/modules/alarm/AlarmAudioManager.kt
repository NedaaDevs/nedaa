package expo.modules.alarm

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
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
    private var vibrator: Vibrator? = null
    private var isVibrating = false
    private var volume: Float = 1.0f

    private fun getVibrator(): Vibrator {
        if (vibrator == null) {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                manager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
        }
        return vibrator!!
    }

    fun startAlarmSound(soundName: String): Boolean {
        stopAlarmSound()
        try {
            val resId = findSoundResource(soundName)
            if (resId == 0) return false

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

            // Force alarm stream to max volume
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM)
            audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxVol, 0)

            return true
        } catch (_: Exception) {
            mediaPlayer?.release()
            mediaPlayer = null
            return false
        }
    }

    fun stopAlarmSound() {
        try {
            mediaPlayer?.let {
                if (it.isPlaying) it.stop()
                it.release()
            }
        } catch (_: Exception) {}
        mediaPlayer = null
    }

    fun isPlaying(): Boolean {
        return try {
            mediaPlayer?.isPlaying == true
        } catch (_: Exception) {
            false
        }
    }

    fun setVolume(vol: Float) {
        volume = vol.coerceIn(0f, 1f)
        try {
            mediaPlayer?.setVolume(volume, volume)
        } catch (_: Exception) {}
    }

    fun getVolume(): Float = volume

    fun startVibration() {
        if (isVibrating) return
        isVibrating = true
        try {
            val vib = getVibrator()
            // 800ms on, 200ms off — matches iOS VIBRATION_PATTERN
            val pattern = longArrayOf(0, 800, 200, 800, 200, 800, 200, 800)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vib.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vib.vibrate(pattern, 0)
            }
        } catch (_: Exception) {
            isVibrating = false
        }
    }

    fun stopVibration() {
        if (!isVibrating) return
        isVibrating = false
        try {
            getVibrator().cancel()
        } catch (_: Exception) {}
    }

    fun stopAll() {
        stopAlarmSound()
        stopVibration()
    }

    private fun findSoundResource(name: String): Int {
        val cleanName = name.replace(Regex("\\.(ogg|mp3|wav|m4a|caf)$"), "")
        val resId = context.resources.getIdentifier(cleanName, "raw", context.packageName)
        if (resId != 0) return resId
        // Fallback to beep
        return context.resources.getIdentifier("beep", "raw", context.packageName)
    }
}
