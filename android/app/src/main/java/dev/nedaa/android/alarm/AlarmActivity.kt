package dev.nedaa.android.alarm

import android.app.Activity
import android.app.KeyguardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.random.Random

class AlarmActivity : Activity() {
    companion object {
        private const val TAG = "AlarmActivity"
        private const val HEARTBEAT_INTERVAL = 3000L
    }

    private var alarmService: AlarmPlaybackService? = null
    private var serviceBound = false
    private val handler = Handler(Looper.getMainLooper())

    // Challenge state
    private var challengeType: String? = null
    private var showingChallenge = false
    private var mathAnswer: Int = 0
    private var tapCount = 0
    private var requiredTaps = 10

    // Views
    private lateinit var containerLayout: LinearLayout
    private lateinit var timeText: TextView
    private lateinit var alarmTitleText: TextView
    private lateinit var alarmTitleArabicText: TextView
    private lateinit var challengeContainer: LinearLayout
    private lateinit var dismissButton: Button
    private lateinit var snoozeButton: Button

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            Log.d(TAG, "Service connected")
            val binder = service as AlarmPlaybackService.LocalBinder
            alarmService = binder.getService()
            serviceBound = true
            startHeartbeat()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            Log.d(TAG, "Service disconnected")
            alarmService = null
            serviceBound = false
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "onCreate")

        setupWindowFlags()
        createUI()
        updateTime()

        // Get challenge type from intent
        challengeType = intent.getStringExtra(AlarmConstants.EXTRA_CHALLENGE_TYPE)
        val alarmType = intent.getStringExtra(AlarmConstants.EXTRA_ALARM_TYPE) ?: AlarmConstants.Defaults.ALARM_TYPE

        // Parse translations from intent
        val translationsJson = intent.getStringExtra(AlarmConstants.EXTRA_TRANSLATIONS_JSON)
        val translations = AlarmTranslations.fromJson(translationsJson)

        // Set alarm title using translations
        alarmTitleText.text = AlarmTranslations.getPrayerTitle(translations, alarmType)
        alarmTitleArabicText.text = if (alarmType == "fajr") "صلاة الفجر" else "صلاة الجمعة"

        // Bind to service
        Intent(this, AlarmPlaybackService::class.java).also { intent ->
            bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)
        }

        // Start time update
        startTimeUpdater()

        // Hide system UI for immersive mode
        hideSystemUI()
    }

    private fun setupWindowFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        // Block back button - user must dismiss via challenge or snooze
        // Note: onBackPressed is deprecated in API 33+ but we intentionally
        // don't call super to block the back gesture for alarm security
        Log.d(TAG, "Back button blocked")
    }

    private fun createUI() {
        containerLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFF000000.toInt())
            gravity = android.view.Gravity.CENTER
            setPadding(48, 48, 48, 48)
        }

        // Time display
        timeText = TextView(this).apply {
            textSize = 72f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = android.view.Gravity.CENTER
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        }
        containerLayout.addView(timeText)

        // Alarm title
        alarmTitleText = TextView(this).apply {
            textSize = 28f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = android.view.Gravity.CENTER
            setPadding(0, 48, 0, 8)
        }
        containerLayout.addView(alarmTitleText)

        // Arabic title
        alarmTitleArabicText = TextView(this).apply {
            textSize = 32f
            setTextColor(0xFF4CAF50.toInt())
            gravity = android.view.Gravity.CENTER
        }
        containerLayout.addView(alarmTitleArabicText)

        // Challenge container (hidden initially)
        challengeContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = android.view.Gravity.CENTER
            visibility = View.GONE
            setPadding(0, 64, 0, 0)
        }
        containerLayout.addView(challengeContainer)

        // Button container
        val buttonContainer = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER
            setPadding(0, 64, 0, 0)
        }

        // Snooze button
        snoozeButton = Button(this).apply {
            text = "Snooze (5m)"
            textSize = 18f
            setTextColor(0xFFFFFFFF.toInt())
            setBackgroundColor(0xFF333333.toInt())
            setPadding(48, 24, 48, 24)
            setOnClickListener { handleSnooze() }
        }

        val snoozeParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { marginEnd = 16 }
        buttonContainer.addView(snoozeButton, snoozeParams)

        // Dismiss button
        dismissButton = Button(this).apply {
            text = "Dismiss"
            textSize = 18f
            setTextColor(0xFFFFFFFF.toInt())
            setBackgroundColor(0xFFE53935.toInt())
            setPadding(48, 24, 48, 24)
            setOnClickListener { handleDismiss() }
        }
        buttonContainer.addView(dismissButton)

        containerLayout.addView(buttonContainer)

        // Challenge hint
        if (!challengeType.isNullOrEmpty() && challengeType != "none") {
            val hintText = TextView(this).apply {
                text = when (challengeType) {
                    "math" -> "Solve a math problem to dismiss"
                    "tap" -> "Tap 10 times to dismiss"
                    else -> ""
                }
                textSize = 14f
                setTextColor(0xFF666666.toInt())
                gravity = android.view.Gravity.CENTER
                setPadding(0, 32, 0, 0)
            }
            containerLayout.addView(hintText)
        }

        setContentView(containerLayout)
    }

    private fun updateTime() {
        val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
        timeText.text = sdf.format(Date())
    }

    private fun startTimeUpdater() {
        handler.postDelayed(object : Runnable {
            override fun run() {
                updateTime()
                handler.postDelayed(this, 1000)
            }
        }, 1000)
    }

    private fun hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let { controller ->
                controller.hide(WindowInsets.Type.systemBars())
                controller.systemBarsBehavior =
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            )
        }
    }

    private fun handleDismiss() {
        Log.d(TAG, "Dismiss pressed, challengeType=$challengeType")

        if (!challengeType.isNullOrEmpty() && challengeType != "none" && !showingChallenge) {
            showChallenge()
            return
        }

        // Complete dismiss
        completeDismiss()
    }

    private fun handleSnooze() {
        Log.d(TAG, "Snooze pressed")

        alarmService?.let { service ->
            val intent = Intent(this, AlarmPlaybackService::class.java).apply {
                action = AlarmConstants.ACTION_SNOOZE_ALARM
            }
            startService(intent)
        }

        finish()
    }

    private fun showChallenge() {
        Log.d(TAG, "Showing challenge: $challengeType")
        showingChallenge = true

        // Hide main buttons
        dismissButton.visibility = View.GONE
        snoozeButton.visibility = View.GONE

        challengeContainer.removeAllViews()
        challengeContainer.visibility = View.VISIBLE

        when (challengeType) {
            "math" -> showMathChallenge()
            "tap" -> showTapChallenge()
        }
    }

    private fun showMathChallenge() {
        // Generate random math problem
        val a = Random.nextInt(10, 50)
        val b = Random.nextInt(10, 50)
        mathAnswer = a + b

        val questionText = TextView(this).apply {
            text = "$a + $b = ?"
            textSize = 36f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = android.view.Gravity.CENTER
        }
        challengeContainer.addView(questionText)

        val answerInput = EditText(this).apply {
            hint = "Answer"
            textSize = 24f
            setTextColor(0xFFFFFFFF.toInt())
            setHintTextColor(0xFF888888.toInt())
            gravity = android.view.Gravity.CENTER
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
            setPadding(32, 16, 32, 16)
        }
        val inputParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            topMargin = 32
        }
        challengeContainer.addView(answerInput, inputParams)

        val submitButton = Button(this).apply {
            text = "Submit"
            textSize = 18f
            setTextColor(0xFFFFFFFF.toInt())
            setBackgroundColor(0xFF4CAF50.toInt())
            setPadding(48, 24, 48, 24)
            setOnClickListener {
                val userAnswer = answerInput.text.toString().toIntOrNull()
                if (userAnswer == mathAnswer) {
                    completeDismiss()
                } else {
                    answerInput.setText("")
                    answerInput.error = "Wrong answer, try again"
                }
            }
        }
        val buttonParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            topMargin = 32
            gravity = android.view.Gravity.CENTER
        }
        challengeContainer.addView(submitButton, buttonParams)
    }

    private fun showTapChallenge() {
        tapCount = 0

        val instructionText = TextView(this).apply {
            text = "Tap the button $requiredTaps times"
            textSize = 24f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = android.view.Gravity.CENTER
        }
        challengeContainer.addView(instructionText)

        val countText = TextView(this).apply {
            text = "0 / $requiredTaps"
            textSize = 48f
            setTextColor(0xFF4CAF50.toInt())
            gravity = android.view.Gravity.CENTER
            setPadding(0, 32, 0, 32)
        }
        challengeContainer.addView(countText)

        val tapButton = Button(this).apply {
            text = "TAP"
            textSize = 24f
            setTextColor(0xFFFFFFFF.toInt())
            setBackgroundColor(0xFF2196F3.toInt())
            setPadding(96, 48, 96, 48)
            setOnClickListener {
                tapCount++
                countText.text = "$tapCount / $requiredTaps"
                if (tapCount >= requiredTaps) {
                    completeDismiss()
                }
            }
        }
        val buttonParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            gravity = android.view.Gravity.CENTER
        }
        challengeContainer.addView(tapButton, buttonParams)
    }

    private fun completeDismiss() {
        Log.d(TAG, "Challenge completed, dismissing alarm")

        alarmService?.let { service ->
            val token = service.getChallengeToken()
            service.verifyChallengeCompletion(token)
        } ?: run {
            // Service not bound, send stop intent directly
            val intent = Intent(this, AlarmPlaybackService::class.java).apply {
                action = AlarmConstants.ACTION_STOP_ALARM
            }
            startService(intent)
        }

        finish()
    }

    private fun startHeartbeat() {
        handler.postDelayed(heartbeatRunnable, HEARTBEAT_INTERVAL)
    }

    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            alarmService?.acknowledgeHeartbeat()
            handler.postDelayed(this, HEARTBEAT_INTERVAL)
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        Log.d(TAG, "User leaving hint received")
        // Don't relaunch here - let the service handle it via heartbeat
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUI()
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "onDestroy")
        handler.removeCallbacksAndMessages(null)
        if (serviceBound) {
            unbindService(serviceConnection)
            serviceBound = false
        }
        super.onDestroy()
    }
}
