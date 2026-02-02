package expo.modules.alarm

import android.os.Bundle
import androidx.preference.ListPreference
import androidx.preference.Preference
import androidx.preference.PreferenceFragmentCompat
import androidx.preference.SeekBarPreference
import androidx.preference.SwitchPreferenceCompat

class AlarmSettingsFragment : PreferenceFragmentCompat() {

    companion object {
        private const val ARG_ALARM_TYPE = "alarm_type"

        fun newInstance(alarmType: String): AlarmSettingsFragment {
            return AlarmSettingsFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_ALARM_TYPE, alarmType)
                }
            }
        }
    }

    private lateinit var alarmType: String
    private lateinit var db: AlarmDatabase

    override fun onCreatePreferences(savedInstanceState: Bundle?, rootKey: String?) {
        setPreferencesFromResource(R.xml.alarm_preferences, rootKey)

        alarmType = arguments?.getString(ARG_ALARM_TYPE) ?: "fajr"
        db = AlarmDatabase.getInstance(requireContext())

        loadSettings()
        setupListeners()
    }

    private fun loadSettings() {
        val settings = db.getAlarmSettings(alarmType)

        findPreference<SwitchPreferenceCompat>("enabled")?.isChecked = settings.enabled
        findPreference<ListPreference>("sound")?.value = settings.sound
        findPreference<SeekBarPreference>("volume")?.value = (settings.volume * 100).toInt()
        findPreference<SwitchPreferenceCompat>("gentle_wakeup_enabled")?.isChecked = settings.gentleWakeUpEnabled
        findPreference<ListPreference>("gentle_wakeup_duration")?.value = settings.gentleWakeUpDuration.toString()
        findPreference<ListPreference>("challenge_type")?.value = settings.challengeType
        findPreference<ListPreference>("challenge_difficulty")?.value = settings.challengeDifficulty
        findPreference<ListPreference>("challenge_count")?.value = settings.challengeCount.toString()
        findPreference<SwitchPreferenceCompat>("vibration_enabled")?.isChecked = settings.vibrationEnabled
        findPreference<ListPreference>("vibration_pattern")?.value = settings.vibrationPattern
        findPreference<SwitchPreferenceCompat>("snooze_enabled")?.isChecked = settings.snoozeEnabled
        findPreference<ListPreference>("snooze_max_count")?.value = settings.snoozeMaxCount.toString()
        findPreference<ListPreference>("snooze_duration")?.value = settings.snoozeDuration.toString()

        // Update summaries
        updateListPreferenceSummary("sound")
        updateListPreferenceSummary("gentle_wakeup_duration")
        updateListPreferenceSummary("challenge_type")
        updateListPreferenceSummary("challenge_difficulty")
        updateListPreferenceSummary("challenge_count")
        updateListPreferenceSummary("vibration_pattern")
        updateListPreferenceSummary("snooze_max_count")
        updateListPreferenceSummary("snooze_duration")

        // Update category visibility based on enabled state
        updateCategoryVisibility(settings.enabled)
    }

    private fun setupListeners() {
        findPreference<SwitchPreferenceCompat>("enabled")?.onPreferenceChangeListener =
            Preference.OnPreferenceChangeListener { _, newValue ->
                db.updateAlarmSetting(alarmType, "enabled", newValue as Boolean)
                updateCategoryVisibility(newValue)
                true
            }

        findPreference<ListPreference>("sound")?.onPreferenceChangeListener =
            Preference.OnPreferenceChangeListener { pref, newValue ->
                db.updateAlarmSetting(alarmType, "sound", newValue as String)
                updateListPreferenceSummaryFromValue(pref as ListPreference, newValue)
                true
            }

        findPreference<SeekBarPreference>("volume")?.onPreferenceChangeListener =
            Preference.OnPreferenceChangeListener { _, newValue ->
                db.updateAlarmSetting(alarmType, "volume", (newValue as Int) / 100f)
                true
            }

        findPreference<SwitchPreferenceCompat>("gentle_wakeup_enabled")?.onPreferenceChangeListener =
            Preference.OnPreferenceChangeListener { _, newValue ->
                db.updateAlarmSetting(alarmType, "gentle_wakeup_enabled", newValue as Boolean)
                true
            }

        findPreference<ListPreference>("gentle_wakeup_duration")?.onPreferenceChangeListener =
            Preference.OnPreferenceChangeListener { pref, newValue ->
                db.updateAlarmSetting(alarmType, "gentle_wakeup_duration", (newValue as String).toInt())
                updateListPreferenceSummaryFromValue(pref as ListPreference, newValue)
                true
            }

        findPreference<ListPreference>("challenge_type")?.onPreferenceChangeListener =
            Preference.OnPreferenceChangeListener { pref, newValue ->
                db.updateAlarmSetting(alarmType, "challenge_type", newValue as String)
                updateListPreferenceSummaryFromValue(pref as ListPreference, newValue)
                true
            }

        findPreference<ListPreference>("challenge_difficulty")?.onPreferenceChangeListener =
            Preference.OnPreferenceChangeListener { pref, newValue ->
                db.updateAlarmSetting(alarmType, "challenge_difficulty", newValue as String)
                updateListPreferenceSummaryFromValue(pref as ListPreference, newValue)
                true
            }

        findPreference<ListPreference>("challenge_count")?.onPreferenceChangeListener =
            Preference.OnPreferenceChangeListener { pref, newValue ->
                db.updateAlarmSetting(alarmType, "challenge_count", (newValue as String).toInt())
                updateListPreferenceSummaryFromValue(pref as ListPreference, newValue)
                true
            }

        findPreference<SwitchPreferenceCompat>("vibration_enabled")?.onPreferenceChangeListener =
            Preference.OnPreferenceChangeListener { _, newValue ->
                db.updateAlarmSetting(alarmType, "vibration_enabled", newValue as Boolean)
                true
            }

        findPreference<ListPreference>("vibration_pattern")?.onPreferenceChangeListener =
            Preference.OnPreferenceChangeListener { pref, newValue ->
                db.updateAlarmSetting(alarmType, "vibration_pattern", newValue as String)
                updateListPreferenceSummaryFromValue(pref as ListPreference, newValue)
                true
            }

        findPreference<SwitchPreferenceCompat>("snooze_enabled")?.onPreferenceChangeListener =
            Preference.OnPreferenceChangeListener { _, newValue ->
                db.updateAlarmSetting(alarmType, "snooze_enabled", newValue as Boolean)
                true
            }

        findPreference<ListPreference>("snooze_max_count")?.onPreferenceChangeListener =
            Preference.OnPreferenceChangeListener { pref, newValue ->
                db.updateAlarmSetting(alarmType, "snooze_max_count", (newValue as String).toInt())
                updateListPreferenceSummaryFromValue(pref as ListPreference, newValue)
                true
            }

        findPreference<ListPreference>("snooze_duration")?.onPreferenceChangeListener =
            Preference.OnPreferenceChangeListener { pref, newValue ->
                db.updateAlarmSetting(alarmType, "snooze_duration", (newValue as String).toInt())
                updateListPreferenceSummaryFromValue(pref as ListPreference, newValue)
                true
            }
    }

    private fun updateListPreferenceSummary(key: String) {
        findPreference<ListPreference>(key)?.let { pref ->
            pref.summary = pref.entry
        }
    }

    private fun updateListPreferenceSummaryFromValue(pref: ListPreference, value: String) {
        val index = pref.findIndexOfValue(value)
        if (index >= 0) {
            pref.summary = pref.entries[index]
        }
    }

    private fun updateCategoryVisibility(enabled: Boolean) {
        findPreference<Preference>("sound_category")?.isVisible = enabled
        findPreference<Preference>("gentle_wakeup_category")?.isVisible = enabled
        findPreference<Preference>("challenge_category")?.isVisible = enabled
        findPreference<Preference>("vibration_category")?.isVisible = enabled
        findPreference<Preference>("snooze_category")?.isVisible = enabled
    }
}
