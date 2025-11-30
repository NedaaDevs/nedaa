package dev.nedaa.android.alarm

/**
 * Centralized constants for the alarm system.
 * All magic strings, action names, and preference keys are defined here.
 */
object AlarmConstants {
    // ==========================================
    // ACTION CONSTANTS
    // ==========================================

    /** Action to start/trigger an alarm */
    const val ACTION_START_ALARM = "dev.nedaa.android.alarm.START_ALARM"

    /** Action to stop/dismiss an alarm */
    const val ACTION_STOP_ALARM = "dev.nedaa.android.alarm.STOP_ALARM"

    /** Action to snooze the current alarm */
    const val ACTION_SNOOZE_ALARM = "dev.nedaa.android.alarm.SNOOZE_ALARM"

    // ==========================================
    // INTENT EXTRA KEYS
    // ==========================================

    /** Alarm type: "fajr" or "jummah" */
    const val EXTRA_ALARM_TYPE = "alarm_type"

    /** Main title text for the alarm */
    const val EXTRA_ALARM_TITLE = "alarm_title"

    /** Body text for the notification */
    const val EXTRA_ALARM_BODY = "alarm_body"

    /** Subtitle text (e.g., "Prayer is better than sleep") */
    const val EXTRA_ALARM_SUBTITLE = "alarm_subtitle"

    /** URI of the alarm sound to play */
    const val EXTRA_SOUND_URI = "sound_uri"

    /** Whether vibration is enabled */
    const val EXTRA_VIBRATION = "vibration"

    /** Minutes to snooze for */
    const val EXTRA_SNOOZE_MINUTES = "snooze_minutes"

    /** Challenge type: "none", "math", or "tap" */
    const val EXTRA_CHALLENGE_TYPE = "challenge_type"

    /** Math challenge difficulty: "easy", "medium", or "hard" */
    const val EXTRA_MATH_DIFFICULTY = "math_difficulty"

    /** Number of math questions to solve */
    const val EXTRA_MATH_QUESTION_COUNT = "math_question_count"

    /** Number of taps required for tap challenge */
    const val EXTRA_TAP_COUNT = "tap_count"

    /** Seconds of grace period before challenge is required */
    const val EXTRA_CHALLENGE_GRACE_PERIOD_SEC = "challenge_grace_period_sec"

    /** JSON string containing UI translations */
    const val EXTRA_TRANSLATIONS_JSON = "translations_json"

    // ==========================================
    // SHARED PREFERENCES
    // ==========================================

    /** Preferences file for scheduled alarms list */
    const val PREFS_SCHEDULED_ALARMS = "scheduled_alarms"

    /** Preferences file for active alarm state */
    const val PREFS_ALARM_STATE = "alarm_state"

    /** Key for the set of scheduled alarm IDs */
    const val PREF_KEY_ALARM_IDS = "alarm_ids"

    /** Key indicating if an alarm is currently active */
    const val PREF_KEY_ALARM_ACTIVE = "alarm_active"

    /** Suffix for alarm timestamp storage */
    const val PREF_SUFFIX_TIMESTAMP = "_timestamp"

    /** Suffix for alarm type storage */
    const val PREF_SUFFIX_TYPE = "_type"

    /** Suffix for alarm title storage */
    const val PREF_SUFFIX_TITLE = "_title"

    // ==========================================
    // NOTIFICATION
    // ==========================================

    /** Notification ID for the alarm service */
    const val NOTIFICATION_ID = 9001

    /** Notification channel ID */
    const val CHANNEL_ID = "prayer_alarm_service"

    /** Notification channel name */
    const val CHANNEL_NAME = "Prayer Alarm Service"

    // ==========================================
    // TIMING
    // ==========================================

    /** Heartbeat check interval in milliseconds */
    const val HEARTBEAT_INTERVAL_MS = 5000L

    /** Timeout for heartbeat acknowledgment */
    const val HEARTBEAT_TIMEOUT_MS = 10000L

    /** Wake lock timeout in milliseconds (10 minutes) */
    const val WAKELOCK_TIMEOUT_MS = 10 * 60 * 1000L

    // ==========================================
    // DEFAULT VALUES
    // ==========================================

    object Defaults {
        const val ALARM_TYPE = "fajr"
        const val ALARM_TITLE = "Prayer Alarm"
        const val ALARM_BODY = "Time to pray"
        const val SNOOZE_MINUTES = 5
        const val MATH_DIFFICULTY = "easy"
        const val MATH_QUESTION_COUNT = 1
        const val TAP_COUNT = 10
        const val CHALLENGE_GRACE_PERIOD_SEC = 15
        const val VIBRATION_ENABLED = true
    }
}
