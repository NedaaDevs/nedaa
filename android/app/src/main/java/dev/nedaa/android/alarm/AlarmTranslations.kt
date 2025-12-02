package dev.nedaa.android.alarm

import android.util.Log
import org.json.JSONObject

/**
 * Helper for parsing and managing alarm UI translations.
 * Translations are passed from TypeScript as JSON and used in native overlay/activity.
 */
object AlarmTranslations {
    private const val TAG = "AlarmTranslations"

    // Translation keys used in the overlay UI
    object Keys {
        const val FAJR_PRAYER = "fajrPrayer"
        const val JUMMAH_PRAYER = "jummahPrayer"
        const val SNOOZE = "snooze"
        const val SNOOZE_WITH_MINUTES = "snoozeWithMinutes"
        const val DISMISS = "dismiss"
        const val PRAYER_BETTER_THAN_SLEEP = "prayerBetterThanSleep"
        const val SOUND_PAUSED_FOR = "soundPausedFor"
        const val SOUND_RESUMES_IN = "soundResumesIn"
        const val SOUND_RESUMED = "soundResumed"
        const val SOLVE_MATH_PROBLEMS = "solveMathProblems"
        const val SOLVE_MATH_PROBLEM = "solveMathProblem"
        const val QUESTION_PROGRESS = "questionProgress"
        const val ANSWER = "answer"
        const val SUBMIT = "submit"
        const val WRONG_ANSWER = "wrongAnswer"
        const val TAP_INSTRUCTION = "tapInstruction"
        const val TAP = "tap"
    }

    // Default English translations (fallback)
    // Uses {{placeholder}} format for consistency with AlarmOverlayView.tr() function
    private val defaultTranslations = mapOf(
        Keys.FAJR_PRAYER to "Fajr Prayer",
        Keys.JUMMAH_PRAYER to "Jummah Prayer",
        Keys.SNOOZE to "Snooze",
        Keys.SNOOZE_WITH_MINUTES to "Snooze ({{minutes}} min)",
        Keys.DISMISS to "Dismiss",
        Keys.PRAYER_BETTER_THAN_SLEEP to "Prayer is better than sleep",
        Keys.SOUND_PAUSED_FOR to "Sound paused for {{seconds}} seconds",
        Keys.SOUND_RESUMES_IN to "Sound resumes in {{seconds}} seconds",
        Keys.SOUND_RESUMED to "Sound resumed",
        Keys.SOLVE_MATH_PROBLEMS to "Solve {{count}} math problems to dismiss",
        Keys.SOLVE_MATH_PROBLEM to "Solve the math problem to dismiss",
        Keys.QUESTION_PROGRESS to "Question {{current}} of {{total}}",
        Keys.ANSWER to "Answer",
        Keys.SUBMIT to "Submit",
        Keys.WRONG_ANSWER to "Wrong answer, try again",
        Keys.TAP_INSTRUCTION to "Tap the button {{count}} times",
        Keys.TAP to "TAP"
    )

    /**
     * Parse translations from JSON string.
     * Returns a map of translation key -> translated value.
     */
    fun fromJson(json: String?): Map<String, String> {
        if (json.isNullOrEmpty()) {
            return defaultTranslations
        }

        return try {
            val result = mutableMapOf<String, String>()
            val jsonObj = JSONObject(json)

            jsonObj.keys().forEach { key ->
                result[key] = jsonObj.getString(key)
            }

            // Merge with defaults for any missing keys
            defaultTranslations.forEach { (key, value) ->
                if (!result.containsKey(key)) {
                    result[key] = value
                }
            }

            result
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse translations JSON", e)
            defaultTranslations
        }
    }

    /**
     * Get a translated string with optional named replacements.
     * Usage: get(translations, "key", "name" to value, "other" to value2)
     */
    fun get(translations: Map<String, String>, key: String, vararg replacements: Pair<String, Any>): String {
        var result = translations[key] ?: defaultTranslations[key] ?: key
        replacements.forEach { (placeholder, value) ->
            result = result.replace("{{$placeholder}}", value.toString())
        }
        return result
    }

    /**
     * Get the prayer title based on alarm type.
     */
    fun getPrayerTitle(translations: Map<String, String>, alarmType: String): String {
        return when (alarmType) {
            "fajr" -> translations[Keys.FAJR_PRAYER] ?: defaultTranslations[Keys.FAJR_PRAYER]!!
            "jummah" -> translations[Keys.JUMMAH_PRAYER] ?: defaultTranslations[Keys.JUMMAH_PRAYER]!!
            else -> translations[Keys.FAJR_PRAYER] ?: defaultTranslations[Keys.FAJR_PRAYER]!!
        }
    }
}
