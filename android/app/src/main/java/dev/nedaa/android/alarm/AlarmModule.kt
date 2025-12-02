package dev.nedaa.android.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments

class AlarmModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    companion object {
        private const val TAG = "AlarmModule"
    }

    override fun getName(): String = "NedaaAlarmModule"

    @ReactMethod
    fun scheduleAlarm(config: ReadableMap, promise: Promise) {
        try {
            val id = config.getString("id") ?: throw Exception("Missing alarm id")
            val timestamp = config.getDouble("timestamp").toLong()
            val alarmType = config.getString("alarmType") ?: "fajr"
            val title = config.getString("title") ?: "Prayer Alarm"
            val body = config.getString("body") ?: "Time to pray"
            val subtitle = if (config.hasKey("subtitle")) config.getString("subtitle") else null
            val soundUri = if (config.hasKey("soundUri")) config.getString("soundUri") else null
            val vibration = if (config.hasKey("vibration")) config.getBoolean("vibration") else true
            val snoozeMinutes = if (config.hasKey("snoozeMinutes")) config.getInt("snoozeMinutes") else 5
            val challengeType = if (config.hasKey("challengeType")) config.getString("challengeType") else null
            val mathDifficulty = if (config.hasKey("mathDifficulty")) config.getString("mathDifficulty") ?: "easy" else "easy"
            val mathQuestionCount = if (config.hasKey("mathQuestionCount")) config.getInt("mathQuestionCount") else 1
            val tapCount = if (config.hasKey("tapCount")) config.getInt("tapCount") else 10
            val challengeGracePeriodSec = if (config.hasKey("challengeGracePeriodSec")) config.getInt("challengeGracePeriodSec") else 15

            Log.d(TAG, "Scheduling alarm: id=$id, time=$timestamp, type=$alarmType, challenge=$challengeType")

            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            // Check if we can schedule exact alarms
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (!alarmManager.canScheduleExactAlarms()) {
                    promise.reject("PERMISSION_DENIED", "Cannot schedule exact alarms")
                    return
                }
            }

            // Build alarm configuration
            val alarmConfig = AlarmIntentHelper.AlarmConfig(
                alarmType = alarmType,
                title = title,
                body = body,
                subtitle = subtitle,
                soundUri = soundUri,
                vibration = vibration,
                snoozeMinutes = snoozeMinutes,
                challengeType = challengeType,
                mathDifficulty = mathDifficulty,
                mathQuestionCount = mathQuestionCount,
                tapCount = tapCount,
                challengeGracePeriodSec = challengeGracePeriodSec
            )

            val intent = Intent(context, AlarmReceiver::class.java).apply {
                action = AlarmConstants.ACTION_START_ALARM
            }
            AlarmIntentHelper.putConfig(intent, alarmConfig)

            val pendingIntent = PendingIntent.getBroadcast(
                context,
                id.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // Use setAlarmClock for reliable alarm delivery
            val alarmClockInfo = AlarmManager.AlarmClockInfo(timestamp, pendingIntent)
            alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)

            // Save alarm info for retrieval
            saveAlarmInfo(id, timestamp, alarmType, title)

            Log.d(TAG, "Alarm scheduled successfully: $id")
            promise.resolve(id)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule alarm", e)
            promise.reject("SCHEDULE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelAlarm(id: String, promise: Promise) {
        try {
            Log.d(TAG, "Cancelling alarm: $id")

            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val intent = Intent(context, AlarmReceiver::class.java).apply {
                action = AlarmConstants.ACTION_START_ALARM
            }

            val pendingIntent = PendingIntent.getBroadcast(
                context,
                id.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()

            // Remove from saved alarms
            removeAlarmInfo(id)

            Log.d(TAG, "Alarm cancelled: $id")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to cancel alarm", e)
            promise.reject("CANCEL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelAllAlarms(promise: Promise) {
        try {
            Log.d(TAG, "Cancelling all alarms")

            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(AlarmConstants.PREFS_SCHEDULED_ALARMS, Context.MODE_PRIVATE)
            val alarmIds = prefs.getStringSet(AlarmConstants.PREF_KEY_ALARM_IDS, emptySet()) ?: emptySet()

            for (id in alarmIds) {
                cancelAlarmById(id)
            }

            // Clear all saved alarms
            prefs.edit().clear().apply()

            Log.d(TAG, "All alarms cancelled")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to cancel all alarms", e)
            promise.reject("CANCEL_ALL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getScheduledAlarms(promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(AlarmConstants.PREFS_SCHEDULED_ALARMS, Context.MODE_PRIVATE)
            val alarmIds = prefs.getStringSet(AlarmConstants.PREF_KEY_ALARM_IDS, emptySet()) ?: emptySet()

            val result: WritableArray = Arguments.createArray()
            for (id in alarmIds) {
                val alarmInfo = getAlarmInfo(id)
                if (alarmInfo != null) {
                    result.pushMap(alarmInfo)
                }
            }

            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get scheduled alarms", e)
            promise.reject("GET_ALARMS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun canScheduleExactAlarms(promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val canSchedule = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                alarmManager.canScheduleExactAlarms()
            } else {
                true
            }

            promise.resolve(canSchedule)
        } catch (e: Exception) {
            promise.reject("CHECK_PERMISSION_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openAlarmPermissionSettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val intent = Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                reactApplicationContext.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OPEN_SETTINGS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        try {
            val canDraw = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.provider.Settings.canDrawOverlays(reactApplicationContext)
            } else {
                true
            }
            promise.resolve(canDraw)
        } catch (e: Exception) {
            promise.reject("CHECK_OVERLAY_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openOverlayPermissionSettings(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(
                    android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    android.net.Uri.parse("package:${reactApplicationContext.packageName}")
                ).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                reactApplicationContext.startActivity(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OPEN_OVERLAY_SETTINGS_ERROR", e.message, e)
        }
    }

    // Helper methods

    private fun cancelAlarmById(id: String) {
        val context = reactApplicationContext
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        val intent = Intent(context, AlarmReceiver::class.java).apply {
            action = AlarmConstants.ACTION_START_ALARM
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        alarmManager.cancel(pendingIntent)
        pendingIntent.cancel()
    }

    private fun saveAlarmInfo(id: String, timestamp: Long, alarmType: String, title: String) {
        val context = reactApplicationContext
        val prefs = context.getSharedPreferences(AlarmConstants.PREFS_SCHEDULED_ALARMS, Context.MODE_PRIVATE)

        // Add to alarm IDs set
        val alarmIds = prefs.getStringSet(AlarmConstants.PREF_KEY_ALARM_IDS, mutableSetOf())?.toMutableSet() ?: mutableSetOf()
        alarmIds.add(id)

        prefs.edit()
            .putStringSet(AlarmConstants.PREF_KEY_ALARM_IDS, alarmIds)
            .putLong("${id}${AlarmConstants.PREF_SUFFIX_TIMESTAMP}", timestamp)
            .putString("${id}${AlarmConstants.PREF_SUFFIX_TYPE}", alarmType)
            .putString("${id}${AlarmConstants.PREF_SUFFIX_TITLE}", title)
            .apply()
    }

    private fun removeAlarmInfo(id: String) {
        val context = reactApplicationContext
        val prefs = context.getSharedPreferences(AlarmConstants.PREFS_SCHEDULED_ALARMS, Context.MODE_PRIVATE)

        val alarmIds = prefs.getStringSet(AlarmConstants.PREF_KEY_ALARM_IDS, mutableSetOf())?.toMutableSet() ?: mutableSetOf()
        alarmIds.remove(id)

        prefs.edit()
            .putStringSet(AlarmConstants.PREF_KEY_ALARM_IDS, alarmIds)
            .remove("${id}${AlarmConstants.PREF_SUFFIX_TIMESTAMP}")
            .remove("${id}${AlarmConstants.PREF_SUFFIX_TYPE}")
            .remove("${id}${AlarmConstants.PREF_SUFFIX_TITLE}")
            .apply()
    }

    private fun getAlarmInfo(id: String): WritableMap? {
        val context = reactApplicationContext
        val prefs = context.getSharedPreferences(AlarmConstants.PREFS_SCHEDULED_ALARMS, Context.MODE_PRIVATE)

        val timestamp = prefs.getLong("${id}${AlarmConstants.PREF_SUFFIX_TIMESTAMP}", 0)
        if (timestamp == 0L) return null

        val map: WritableMap = Arguments.createMap()
        map.putString("id", id)
        map.putDouble("timestamp", timestamp.toDouble())
        map.putString("alarmType", prefs.getString("${id}${AlarmConstants.PREF_SUFFIX_TYPE}", AlarmConstants.Defaults.ALARM_TYPE))
        map.putString("title", prefs.getString("${id}${AlarmConstants.PREF_SUFFIX_TITLE}", AlarmConstants.Defaults.ALARM_TITLE))
        return map
    }
}
