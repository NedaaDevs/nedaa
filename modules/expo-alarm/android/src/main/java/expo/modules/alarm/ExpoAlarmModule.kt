package expo.modules.alarm

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoAlarmModule : Module() {

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
                promise.resolve(scheduled)
            } catch (e: Exception) {
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

        // Completed queue (for processing alarms completed via overlay)
        AsyncFunction("getCompletedQueue") {
            db.getCompletedQueue().map { record ->
                mapOf(
                    "alarmId" to record.alarmId,
                    "alarmType" to record.alarmType,
                    "title" to record.title,
                    "completedAt" to record.completedAt
                )
            }
        }

        AsyncFunction("clearCompletedQueue") {
            db.clearCompletedQueue()
            true
        }

        // Snooze queue (for processing alarms snoozed via overlay)
        AsyncFunction("getSnoozeQueue") {
            db.getSnoozeQueue().map { record ->
                mapOf(
                    "originalAlarmId" to record.originalAlarmId,
                    "snoozeAlarmId" to record.snoozeAlarmId,
                    "alarmType" to record.alarmType,
                    "title" to record.title,
                    "snoozeCount" to record.snoozeCount,
                    "snoozeEndTime" to record.snoozeEndTime
                )
            }
        }

        AsyncFunction("clearSnoozeQueue") {
            db.clearSnoozeQueue()
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
            // Stop all alarm services
            if (AlarmService.isRunning) {
                AlarmService.stop(context)
            }
            if (AlarmOverlayService.isRunning) {
                AlarmOverlayService.stop(context)
            }
            true
        }

        Function("setAlarmVolume") { volume: Float ->
            audioManager.setVolume(volume)
            true
        }

        Function("getAlarmVolume") {
            audioManager.getVolume()
        }

        Function("saveSystemVolume") {
            audioManager.saveSystemVolume()
            true
        }

        Function("restoreSystemVolume") {
            audioManager.restoreSystemVolume()
            true
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

        Function("getPersistentLog") {
            val logger = AlarmLogger.getInstance(context)
            logger.getFullLog()
        }

        Function("clearPersistentLog") {
            val logger = AlarmLogger.getInstance(context)
            logger.clear()
            true
        }

        AsyncFunction("getNativeLogs") {
            val logger = AlarmLogger.getInstance(context)
            logger.getLogs()
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

        Function("canUseFullScreenIntent") {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                nm.canUseFullScreenIntent()
            } else {
                true
            }
        }

        Function("requestFullScreenIntentPermission") {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                if (!nm.canUseFullScreenIntent()) {
                    val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
                        data = Uri.parse("package:${context.packageName}")
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    context.startActivity(intent)
                }
            }
            true
        }

        Function("canDrawOverlays") {
            Settings.canDrawOverlays(context)
        }

        Function("requestDrawOverlaysPermission") {
            if (!Settings.canDrawOverlays(context)) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${context.packageName}")
                ).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
            }
            true
        }

        // Auto-start permission (OEM-specific)
        Function("getDeviceManufacturer") {
            Build.MANUFACTURER.lowercase()
        }

        Function("openAutoStartSettings") {
            openAutoStartSettings()
        }

        Function("hasAutoStartSettings") {
            getAutoStartIntent() != null
        }

        // -- Native Settings --

        Function("openNativeSettings") { alarmType: String ->
            try {
                val intent = AlarmSettingsActivity.createIntent(context, alarmType)
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                context.startActivity(intent)
                true
            } catch (e: Exception) {
                false
            }
        }

        AsyncFunction("getAlarmSettings") { alarmType: String ->
            val settings = db.getAlarmSettings(alarmType)
            mapOf(
                "enabled" to settings.enabled,
                "sound" to settings.sound,
                "volume" to settings.volume,
                "challengeType" to settings.challengeType,
                "challengeDifficulty" to settings.challengeDifficulty,
                "challengeCount" to settings.challengeCount,
                "gentleWakeUpEnabled" to settings.gentleWakeUpEnabled,
                "gentleWakeUpDuration" to settings.gentleWakeUpDuration,
                "vibrationEnabled" to settings.vibrationEnabled,
                "vibrationPattern" to settings.vibrationPattern,
                "snoozeEnabled" to settings.snoozeEnabled,
                "snoozeMaxCount" to settings.snoozeMaxCount,
                "snoozeDuration" to settings.snoozeDuration
            )
        }

        AsyncFunction("setAlarmSettings") { alarmType: String, settingsMap: Map<String, Any> ->
            val currentSettings = db.getAlarmSettings(alarmType)
            val newSettings = AlarmDatabase.AlarmSettingsRecord(
                alarmType = alarmType,
                enabled = (settingsMap["enabled"] as? Boolean) ?: currentSettings.enabled,
                sound = (settingsMap["sound"] as? String) ?: currentSettings.sound,
                volume = ((settingsMap["volume"] as? Number)?.toFloat()) ?: currentSettings.volume,
                challengeType = (settingsMap["challengeType"] as? String) ?: currentSettings.challengeType,
                challengeDifficulty = (settingsMap["challengeDifficulty"] as? String) ?: currentSettings.challengeDifficulty,
                challengeCount = ((settingsMap["challengeCount"] as? Number)?.toInt()) ?: currentSettings.challengeCount,
                gentleWakeUpEnabled = (settingsMap["gentleWakeUpEnabled"] as? Boolean) ?: currentSettings.gentleWakeUpEnabled,
                gentleWakeUpDuration = ((settingsMap["gentleWakeUpDuration"] as? Number)?.toInt()) ?: currentSettings.gentleWakeUpDuration,
                vibrationEnabled = (settingsMap["vibrationEnabled"] as? Boolean) ?: currentSettings.vibrationEnabled,
                vibrationPattern = (settingsMap["vibrationPattern"] as? String) ?: currentSettings.vibrationPattern,
                snoozeEnabled = (settingsMap["snoozeEnabled"] as? Boolean) ?: currentSettings.snoozeEnabled,
                snoozeMaxCount = ((settingsMap["snoozeMaxCount"] as? Number)?.toInt()) ?: currentSettings.snoozeMaxCount,
                snoozeDuration = ((settingsMap["snoozeDuration"] as? Number)?.toInt()) ?: currentSettings.snoozeDuration
            )
            db.saveAlarmSettings(newSettings)
            true
        }

        Function("isAlarmTypeEnabled") { alarmType: String ->
            db.isAlarmEnabled(alarmType)
        }

        // -- System Sounds --

        AsyncFunction("getSystemAlarmSounds") {
            val sounds = mutableListOf<Map<String, String>>()
            try {
                val ringtoneManager = RingtoneManager(context)
                ringtoneManager.setType(RingtoneManager.TYPE_ALARM)
                val cursor = ringtoneManager.cursor
                while (cursor.moveToNext()) {
                    val position = cursor.position
                    val title = ringtoneManager.getRingtone(position)?.getTitle(context) ?: "Unknown"
                    val uri = ringtoneManager.getRingtoneUri(position)?.toString() ?: continue
                    sounds.add(mapOf(
                        "id" to uri,
                        "name" to title,
                        "isSystem" to "true"
                    ))
                }
            } catch (_: Exception) {}
            sounds
        }
    }

    private fun openAutoStartSettings(): Boolean {
        val intent = getAutoStartIntent()
        if (intent != null) {
            try {
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                context.startActivity(intent)
                return true
            } catch (_: Exception) {}
        }

        // Fallback: open app info settings
        return try {
            val fallbackIntent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${context.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(fallbackIntent)
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun getAutoStartIntent(): Intent? {
        val manufacturer = Build.MANUFACTURER.lowercase()

        val intents = when {
            manufacturer.contains("xiaomi") || manufacturer.contains("redmi") -> listOf(
                Intent().setComponent(ComponentName(
                    "com.miui.securitycenter",
                    "com.miui.permcenter.autostart.AutoStartManagementActivity"
                )),
                Intent().setComponent(ComponentName(
                    "com.miui.securitycenter",
                    "com.miui.powercenter.PowerSettings"
                ))
            )
            manufacturer.contains("oppo") -> listOf(
                Intent().setComponent(ComponentName(
                    "com.coloros.safecenter",
                    "com.coloros.safecenter.permission.startup.StartupAppListActivity"
                )),
                Intent().setComponent(ComponentName(
                    "com.oppo.safe",
                    "com.oppo.safe.permission.startup.StartupAppListActivity"
                )),
                Intent().setComponent(ComponentName(
                    "com.coloros.safecenter",
                    "com.coloros.safecenter.startupapp.StartupAppListActivity"
                ))
            )
            manufacturer.contains("vivo") -> listOf(
                Intent().setComponent(ComponentName(
                    "com.iqoo.secure",
                    "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"
                )),
                Intent().setComponent(ComponentName(
                    "com.vivo.permissionmanager",
                    "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"
                )),
                Intent().setComponent(ComponentName(
                    "com.iqoo.secure",
                    "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"
                ))
            )
            manufacturer.contains("huawei") || manufacturer.contains("honor") -> listOf(
                Intent().setComponent(ComponentName(
                    "com.huawei.systemmanager",
                    "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"
                )),
                Intent().setComponent(ComponentName(
                    "com.huawei.systemmanager",
                    "com.huawei.systemmanager.optimize.process.ProtectActivity"
                )),
                Intent().setComponent(ComponentName(
                    "com.huawei.systemmanager",
                    "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity"
                ))
            )
            manufacturer.contains("samsung") -> listOf(
                Intent().setComponent(ComponentName(
                    "com.samsung.android.lool",
                    "com.samsung.android.sm.battery.ui.BatteryActivity"
                )),
                Intent().setComponent(ComponentName(
                    "com.samsung.android.sm",
                    "com.samsung.android.sm.battery.ui.BatteryActivity"
                ))
            )
            manufacturer.contains("oneplus") -> listOf(
                Intent().setComponent(ComponentName(
                    "com.oneplus.security",
                    "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"
                ))
            )
            manufacturer.contains("realme") -> listOf(
                Intent().setComponent(ComponentName(
                    "com.coloros.safecenter",
                    "com.coloros.safecenter.permission.startup.StartupAppListActivity"
                )),
                Intent().setComponent(ComponentName(
                    "com.oplus.safecenter",
                    "com.oplus.safecenter.permission.startup.StartupAppListActivity"
                ))
            )
            manufacturer.contains("asus") -> listOf(
                Intent().setComponent(ComponentName(
                    "com.asus.mobilemanager",
                    "com.asus.mobilemanager.autostart.AutoStartActivity"
                ))
            )
            manufacturer.contains("lenovo") -> listOf(
                Intent().setComponent(ComponentName(
                    "com.lenovo.security",
                    "com.lenovo.security.purebackground.PureBackgroundActivity"
                ))
            )
            else -> emptyList()
        }

        // Return the first intent that can be resolved
        val pm = context.packageManager
        for (intent in intents) {
            if (intent.resolveActivity(pm) != null) {
                return intent
            }
        }

        return null
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

        // Check full-screen intent permission (API 34+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (!nm.canUseFullScreenIntent()) return "denied"
        }

        return "authorized"
    }
}
