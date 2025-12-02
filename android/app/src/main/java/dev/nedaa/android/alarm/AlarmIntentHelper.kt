package dev.nedaa.android.alarm

import android.content.Intent

/**
 * Helper for reading and writing alarm configuration to/from Intents.
 * Centralizes all intent extra handling to avoid duplication.
 */
object AlarmIntentHelper {

    /**
     * Data class holding all alarm configuration values.
     */
    data class AlarmConfig(
        val alarmType: String = AlarmConstants.Defaults.ALARM_TYPE,
        val title: String = AlarmConstants.Defaults.ALARM_TITLE,
        val body: String = AlarmConstants.Defaults.ALARM_BODY,
        val subtitle: String? = null,
        val soundUri: String? = null,
        val vibration: Boolean = AlarmConstants.Defaults.VIBRATION_ENABLED,
        val snoozeMinutes: Int = AlarmConstants.Defaults.SNOOZE_MINUTES,
        val challengeType: String? = null,
        val mathDifficulty: String = AlarmConstants.Defaults.MATH_DIFFICULTY,
        val mathQuestionCount: Int = AlarmConstants.Defaults.MATH_QUESTION_COUNT,
        val tapCount: Int = AlarmConstants.Defaults.TAP_COUNT,
        val challengeGracePeriodSec: Int = AlarmConstants.Defaults.CHALLENGE_GRACE_PERIOD_SEC
    ) {
        /** Returns true if a challenge is configured */
        val hasChallenge: Boolean
            get() = !challengeType.isNullOrEmpty() && challengeType != "none"
    }

    /**
     * Extract alarm configuration from an Intent.
     */
    fun extractConfig(intent: Intent): AlarmConfig {
        return AlarmConfig(
            alarmType = intent.getStringExtra(AlarmConstants.EXTRA_ALARM_TYPE)
                ?: AlarmConstants.Defaults.ALARM_TYPE,
            title = intent.getStringExtra(AlarmConstants.EXTRA_ALARM_TITLE)
                ?: AlarmConstants.Defaults.ALARM_TITLE,
            body = intent.getStringExtra(AlarmConstants.EXTRA_ALARM_BODY)
                ?: AlarmConstants.Defaults.ALARM_BODY,
            subtitle = intent.getStringExtra(AlarmConstants.EXTRA_ALARM_SUBTITLE),
            soundUri = intent.getStringExtra(AlarmConstants.EXTRA_SOUND_URI),
            vibration = intent.getBooleanExtra(
                AlarmConstants.EXTRA_VIBRATION,
                AlarmConstants.Defaults.VIBRATION_ENABLED
            ),
            snoozeMinutes = intent.getIntExtra(
                AlarmConstants.EXTRA_SNOOZE_MINUTES,
                AlarmConstants.Defaults.SNOOZE_MINUTES
            ),
            challengeType = intent.getStringExtra(AlarmConstants.EXTRA_CHALLENGE_TYPE),
            mathDifficulty = intent.getStringExtra(AlarmConstants.EXTRA_MATH_DIFFICULTY)
                ?: AlarmConstants.Defaults.MATH_DIFFICULTY,
            mathQuestionCount = intent.getIntExtra(
                AlarmConstants.EXTRA_MATH_QUESTION_COUNT,
                AlarmConstants.Defaults.MATH_QUESTION_COUNT
            ),
            tapCount = intent.getIntExtra(
                AlarmConstants.EXTRA_TAP_COUNT,
                AlarmConstants.Defaults.TAP_COUNT
            ),
            challengeGracePeriodSec = intent.getIntExtra(
                AlarmConstants.EXTRA_CHALLENGE_GRACE_PERIOD_SEC,
                AlarmConstants.Defaults.CHALLENGE_GRACE_PERIOD_SEC
            )
        )
    }

    /**
     * Write alarm configuration to an Intent.
     */
    fun putConfig(intent: Intent, config: AlarmConfig): Intent {
        return intent.apply {
            putExtra(AlarmConstants.EXTRA_ALARM_TYPE, config.alarmType)
            putExtra(AlarmConstants.EXTRA_ALARM_TITLE, config.title)
            putExtra(AlarmConstants.EXTRA_ALARM_BODY, config.body)
            putExtra(AlarmConstants.EXTRA_ALARM_SUBTITLE, config.subtitle)
            putExtra(AlarmConstants.EXTRA_SOUND_URI, config.soundUri)
            putExtra(AlarmConstants.EXTRA_VIBRATION, config.vibration)
            putExtra(AlarmConstants.EXTRA_SNOOZE_MINUTES, config.snoozeMinutes)
            putExtra(AlarmConstants.EXTRA_CHALLENGE_TYPE, config.challengeType)
            putExtra(AlarmConstants.EXTRA_MATH_DIFFICULTY, config.mathDifficulty)
            putExtra(AlarmConstants.EXTRA_MATH_QUESTION_COUNT, config.mathQuestionCount)
            putExtra(AlarmConstants.EXTRA_TAP_COUNT, config.tapCount)
            putExtra(AlarmConstants.EXTRA_CHALLENGE_GRACE_PERIOD_SEC, config.challengeGracePeriodSec)
        }
    }

    /**
     * Copy all alarm extras from source intent to destination intent.
     */
    fun copyExtras(from: Intent, to: Intent): Intent {
        return putConfig(to, extractConfig(from))
    }
}
