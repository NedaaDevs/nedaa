package expo.modules.alarm

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.MenuItem
import androidx.appcompat.app.AppCompatActivity

class AlarmSettingsActivity : AppCompatActivity() {

    companion object {
        private const val EXTRA_ALARM_TYPE = "alarm_type"

        fun createIntent(context: Context, alarmType: String): Intent {
            return Intent(context, AlarmSettingsActivity::class.java).apply {
                putExtra(EXTRA_ALARM_TYPE, alarmType)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_alarm_settings)

        val alarmType = intent.getStringExtra(EXTRA_ALARM_TYPE) ?: "fajr"

        // Set title based on alarm type
        title = when (alarmType) {
            "fajr" -> getString(R.string.fajr_alarm_title)
            "friday" -> getString(R.string.friday_alarm_title)
            else -> getString(R.string.alarm_settings_title)
        }

        // Enable back button in action bar
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        // Load the settings fragment
        if (savedInstanceState == null) {
            supportFragmentManager
                .beginTransaction()
                .replace(R.id.settings_container, AlarmSettingsFragment.newInstance(alarmType))
                .commit()
        }
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            android.R.id.home -> {
                onBackPressedDispatcher.onBackPressed()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }
}
