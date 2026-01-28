package expo.modules.alarm

import android.Manifest
import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoAlarmModule : Module() {

    companion object {
        private const val TAG = "ExpoAlarmModule"
    }

    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React context not available")

    private val db: AlarmDatabase
        get() = AlarmDatabase.getInstance(context)

    private val scheduler: AlarmScheduler
        get() = AlarmScheduler(context)

    private val audioManager: AlarmAudioManager
        get() = AlarmAudioManager.getInstance(context)

    override fun definition() = ModuleDefinition {
        Name("ExpoAlarm")

        // -- Authorization --

        AsyncFunction("requestAuthorization") { promise: Promise ->
            promise.resolve(getAuthStatus())
        }

        AsyncFunction("getAuthorizationStatus") { promise: Promise ->
            promise.resolve(getAuthStatus())
        }

        Function("isAlarmKitAvailable") {
            false
        }

        Function("getBackgroundRefreshStatus") {
            "available"
        }

        // -- Scheduling --

        AsyncFunction("scheduleAlarm") { id: String, triggerTimestamp: Double, title: String, alarmType: String, sound: String, _dismissText: String, _openText: String, promise: Promise ->
            try {
                val triggerMs = triggerTimestamp.toLong()
                val soundName = if (sound.isNotEmpty()) sound else "beep"

                db.saveAlarm(
                    id = id,
                    alarmType = alarmType,
                    title = title,
                    triggerTime = triggerTimestamp,
                    isBackup = false
                )

                val scheduled = scheduler.scheduleAlarm(id, triggerMs, alarmType, title, soundName)
                if (!scheduled) {
                    Log.w(TAG, "scheduleAlarm failed — exact alarm permission denied")
                }
                promise.resolve(scheduled)
            } catch (e: Exception) {
                Log.e(TAG, "scheduleAlarm error: ${e.message}")
                promise.reject("SCHEDULE_ERROR", e.message, e)
            }
        }

        AsyncFunction("cancelAlarm") { id: String, promise: Promise ->
            try {
                scheduler.cancelAlarm(id)
                db.deleteAlarm(id)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.resolve(true)
            }
        }

        AsyncFunction("cancelAllAlarms") { promise: Promise ->
            try {
                val ids = db.getAllAlarmIds()
                scheduler.cancelAll(ids)
                db.deleteAllAlarms()
                db.clearPendingChallenge()
                db.clearBypassState()
                if (AlarmService.isRunning) {
                    AlarmService.stop(context)
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.resolve(null)
            }
        }

        Function("getScheduledAlarmIds") {
            db.getAllAlarmIds().toTypedArray()
        }

        // -- Database --

        Function("markAlarmCompleted") { id: String ->
            db.markCompleted(id)
            true
        }

        Function("deleteAlarmFromDB") { id: String ->
            db.deleteAlarm(id)
            true
        }

        // -- Challenge Management --

        AsyncFunction("getPendingChallenge") {
            val pending = db.getPendingChallenge() ?: return@AsyncFunction null
            mapOf(
                "alarmId" to pending.alarmId,
                "alarmType" to pending.alarmType,
                "title" to pending.title,
                "timestamp" to pending.timestamp
            )
        }

        AsyncFunction("clearPendingChallenge") {
            db.clearPendingChallenge()
            true
        }

        AsyncFunction("clearCompletedChallenges") {
            db.clearAllCompleted()
            true
        }

        // -- Audio & Effects --

        AsyncFunction("startAlarmSound") { soundName: String ->
            audioManager.startAlarmSound(soundName)
        }

        AsyncFunction("stopAlarmSound") {
            audioManager.stopAlarmSound()
            true
        }

        Function("isAlarmSoundPlaying") {
            audioManager.isPlaying()
        }

        Function("stopAllAlarmEffects") {
            audioManager.stopAll()
            true
        }

        Function("setAlarmVolume") { volume: Float ->
            audioManager.setVolume(volume)
            true
        }

        Function("getAlarmVolume") {
            audioManager.getVolume()
        }

        // -- Scheduling Info --

        Function("getNextAlarmTime") {
            db.getNextAlarmTime()
        }

        // -- iOS-only stubs --

        AsyncFunction("startLiveActivity") { _alarmId: String, _alarmType: String, _title: String, _triggerTimestamp: Double ->
            null
        }

        AsyncFunction("updateLiveActivity") { _activityId: String, _state: String ->
            false
        }

        AsyncFunction("endLiveActivity") { _activityId: String ->
            false
        }

        AsyncFunction("endAllLiveActivities") {
            false
        }

        AsyncFunction("cancelAllBackups") { promise: Promise ->
            promise.resolve(0)
        }

        AsyncFunction("getAlarmKitAlarms") {
            emptyArray<Any>()
        }

        AsyncFunction("getNativeLogs") {
            emptyArray<Any>()
        }

        Function("getPersistentLog") {
            ""
        }

        Function("clearPersistentLog") {
            false
        }

        // -- Android-specific --

        Function("isBatteryOptimizationExempt") {
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            pm.isIgnoringBatteryOptimizations(context.packageName)
        }

        Function("requestBatteryOptimizationExemption") {
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(context.packageName)) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:${context.packageName}")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
            }
            true
        }
    }

    private fun getAuthStatus(): String {
        // Check notification permission (API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val notifGranted = ContextCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!notifGranted) return "denied"
        }

        // Check exact alarm permission (API 31+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            if (!am.canScheduleExactAlarms()) return "denied"
        }

        return "authorized"
    }
}
