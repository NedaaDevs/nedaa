package expo.modules.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.text.InputType
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import java.util.UUID
import kotlin.random.Random

class AlarmOverlayService : Service() {

    companion object {
        private const val NOTIFICATION_ID = 9001
        private const val CHANNEL_ID = "alarm_overlay_channel"

        // Tap counts per difficulty
        private const val TAPS_EASY = 5
        private const val TAPS_MEDIUM = 10
        private const val TAPS_HARD = 20

        @Volatile
        var isRunning = false
            private set

        fun start(context: Context, alarmId: String, alarmType: String, title: String) {
            if (!Settings.canDrawOverlays(context)) return

            val intent = Intent(context, AlarmOverlayService::class.java).apply {
                putExtra("alarm_id", alarmId)
                putExtra("alarm_type", alarmType)
                putExtra("title", title)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, AlarmOverlayService::class.java))
        }
    }

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null

    private var alarmId: String = ""
    private var alarmType: String = ""
    private var title: String = ""

    // Challenge state
    private var challengeType: String = "tap"
    private var challengeDifficulty: String = "easy"
    private var challengeCount: Int = 1
    private var requiredTaps: Int = TAPS_EASY

    // Tap challenge state
    private var tapCount = 0
    private var tapButton: Button? = null
    private var tapCountText: TextView? = null

    // Math challenge state
    private var mathProblemText: TextView? = null
    private var mathAnswerInput: EditText? = null
    private var mathSubmitButton: Button? = null
    private var mathProgressText: TextView? = null
    private var currentMathAnswer: Int = 0
    private var completedMathChallenges: Int = 0

    override fun onCreate() {
        super.onCreate()
        isRunning = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        alarmId = intent?.getStringExtra("alarm_id") ?: ""
        alarmType = intent?.getStringExtra("alarm_type") ?: ""
        title = intent?.getStringExtra("title") ?: "Alarm"

        // Load challenge settings from database
        loadChallengeSettings()

        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        showOverlay()

        return START_STICKY
    }

    private fun loadChallengeSettings() {
        val db = AlarmDatabase.getInstance(this)
        val (type, difficulty, count) = db.getChallengeConfig(alarmType)
        challengeType = type
        challengeDifficulty = difficulty
        challengeCount = count

        // Calculate required taps based on difficulty and count
        val baseTaps = when (difficulty) {
            "easy" -> TAPS_EASY
            "medium" -> TAPS_MEDIUM
            "hard" -> TAPS_HARD
            else -> TAPS_EASY
        }
        requiredTaps = baseTaps * count

        AlarmLogger.getInstance(this).d("AlarmOverlay", "Challenge settings: type=$challengeType, difficulty=$challengeDifficulty, count=$challengeCount, requiredTaps=$requiredTaps")
    }

    override fun onDestroy() {
        removeOverlay()
        isRunning = false
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Alarm Overlay",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows alarm overlay"
                setShowBadge(false)
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val openIntent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("dev.nedaa.app://alarm?alarmId=$alarmId&alarmType=$alarmType")
            component = ComponentName(packageName, "$packageName.MainActivity")
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val contentText = when (challengeType) {
            "math" -> if (challengeCount == 1) {
                getString(R.string.overlay_notification_math_one)
            } else {
                getString(R.string.overlay_notification_math_many, challengeCount)
            }
            "none" -> getString(R.string.overlay_notification_dismiss)
            else -> getString(R.string.overlay_notification_tap, requiredTaps)
        }

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(getString(R.string.overlay_notification_title))
                .setContentText(contentText)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(getString(R.string.overlay_notification_title))
                .setContentText(contentText)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build()
        }
    }

    private fun showOverlay() {
        if (!Settings.canDrawOverlays(this)) {
            stopSelf()
            return
        }

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#EE1a1a2e"))
            setPadding(64, 64, 64, 64)
        }

        val titleView = TextView(this).apply {
            text = title
            textSize = 36f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, 0, 0, 16)
        }
        layout.addView(titleView)

        // Build challenge-specific UI
        when (challengeType) {
            "math" -> buildMathChallengeUI(layout)
            "none" -> buildDirectDismissUI(layout)
            else -> buildTapChallengeUI(layout)
        }

        // Snooze button (common to both challenge types)
        val db = AlarmDatabase.getInstance(this)
        val (snoozeEnabled, snoozeMaxCount, snoozeDurationMinutes) = db.getSnoozeConfig(alarmType)
        val currentSnoozeCount = db.getSnoozeCount(alarmId)
        val remainingSnoozes = snoozeMaxCount - currentSnoozeCount
        val canSnooze = snoozeEnabled && remainingSnoozes > 0

        AlarmLogger.getInstance(this).d("AlarmOverlay", "Snooze settings - enabled=$snoozeEnabled, maxCount=$snoozeMaxCount, duration=$snoozeDurationMinutes, current=$currentSnoozeCount, remaining=$remainingSnoozes")

        val snoozeButton = Button(this).apply {
            text = if (canSnooze) getString(R.string.overlay_snooze_button, remainingSnoozes) else getString(R.string.overlay_snooze_none)
            textSize = 16f
            setTextColor(Color.WHITE)
            setBackgroundColor(if (canSnooze) Color.parseColor("#FF9800") else Color.parseColor("#666666"))
            setPadding(48, 24, 48, 24)
            isEnabled = canSnooze
            visibility = if (snoozeEnabled) View.VISIBLE else View.GONE
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = 32 }
            layoutParams = params
            setOnClickListener { onSnoozeClicked() }
        }
        layout.addView(snoozeButton)

        overlayView = layout

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
        }

        // Math challenge needs focusable for keyboard input
        val windowFlags = if (challengeType == "math") {
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        } else {
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            layoutType,
            windowFlags,
            PixelFormat.TRANSLUCENT
        )
        params.gravity = Gravity.CENTER

        try {
            windowManager?.addView(overlayView, params)
        } catch (_: Exception) {}
    }

    private fun buildTapChallengeUI(layout: LinearLayout) {
        val subtitleView = TextView(this).apply {
            text = getString(R.string.overlay_tap_instruction, requiredTaps)
            textSize = 18f
            setTextColor(Color.parseColor("#AAAAAA"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 48)
        }
        layout.addView(subtitleView)

        tapCountText = TextView(this).apply {
            text = getString(R.string.overlay_tap_progress, 0, requiredTaps)
            textSize = 72f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, 0, 0, 32)
        }
        layout.addView(tapCountText)

        tapButton = Button(this).apply {
            text = getString(R.string.overlay_tap_button)
            textSize = 24f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#4CAF50"))
            setPadding(64, 48, 64, 48)
            setOnClickListener { onTapButtonClicked() }
        }
        layout.addView(tapButton)
    }

    private fun buildDirectDismissUI(layout: LinearLayout) {
        val subtitleView = TextView(this).apply {
            text = getString(R.string.overlay_dismiss_instruction)
            textSize = 18f
            setTextColor(Color.parseColor("#AAAAAA"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 48)
        }
        layout.addView(subtitleView)

        val dismissButton = Button(this).apply {
            text = getString(R.string.overlay_dismiss_button)
            textSize = 24f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#4CAF50"))
            setPadding(64, 48, 64, 48)
            setOnClickListener { completeAlarm() }
        }
        layout.addView(dismissButton)
    }

    private fun buildMathChallengeUI(layout: LinearLayout) {
        val subtitleView = TextView(this).apply {
            text = if (challengeCount == 1) {
                getString(R.string.overlay_math_instruction_one)
            } else {
                getString(R.string.overlay_math_instruction_many, challengeCount)
            }
            textSize = 18f
            setTextColor(Color.parseColor("#AAAAAA"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 24)
        }
        layout.addView(subtitleView)

        mathProgressText = TextView(this).apply {
            text = getString(R.string.overlay_math_progress, 1, challengeCount)
            textSize = 16f
            setTextColor(Color.parseColor("#AAAAAA"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 16)
        }
        layout.addView(mathProgressText)

        mathProblemText = TextView(this).apply {
            textSize = 48f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, 0, 0, 32)
        }
        layout.addView(mathProblemText)

        mathAnswerInput = EditText(this).apply {
            hint = getString(R.string.overlay_math_hint)
            textSize = 32f
            setTextColor(Color.WHITE)
            setHintTextColor(Color.parseColor("#666666"))
            setBackgroundColor(Color.parseColor("#333333"))
            gravity = Gravity.CENTER
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_SIGNED
            imeOptions = EditorInfo.IME_ACTION_DONE
            setPadding(48, 24, 48, 24)
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                width = 300
            }
            layoutParams = params
            setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_DONE) {
                    onMathAnswerSubmitted()
                    true
                } else {
                    false
                }
            }
        }
        layout.addView(mathAnswerInput)

        mathSubmitButton = Button(this).apply {
            text = getString(R.string.overlay_math_submit)
            textSize = 24f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#4CAF50"))
            setPadding(64, 48, 64, 48)
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = 24 }
            layoutParams = params
            setOnClickListener { onMathAnswerSubmitted() }
        }
        layout.addView(mathSubmitButton)

        // Generate first problem
        generateMathProblem()
    }

    private fun generateMathProblem() {
        val maxNum = when (challengeDifficulty) {
            "easy" -> 10
            "medium" -> 50
            "hard" -> 100
            else -> 10
        }

        val operations = if (challengeDifficulty == "hard") {
            listOf("+", "-", "*")
        } else {
            listOf("+", "-")
        }

        val op = operations.random()
        var a = Random.nextInt(1, maxNum + 1)
        var b = Random.nextInt(1, maxNum + 1)

        // For subtraction, ensure result is non-negative for easier solving
        if (op == "-" && a < b) {
            val temp = a
            a = b
            b = temp
        }

        currentMathAnswer = when (op) {
            "+" -> a + b
            "-" -> a - b
            "*" -> a * b
            else -> a + b
        }

        mathProblemText?.text = "$a $op $b = ?"
        mathAnswerInput?.setText("")
        mathProgressText?.text = getString(R.string.overlay_math_progress, completedMathChallenges + 1, challengeCount)
    }

    private fun onMathAnswerSubmitted() {
        val userAnswer = mathAnswerInput?.text?.toString()?.trim()?.toIntOrNull()

        if (userAnswer == null) {
            showMathError(getString(R.string.overlay_math_invalid))
            return
        }

        if (userAnswer == currentMathAnswer) {
            completedMathChallenges++

            if (completedMathChallenges >= challengeCount) {
                completeAlarm()
            } else {
                // Show success feedback
                mathSubmitButton?.setBackgroundColor(Color.parseColor("#66BB6A"))
                mathSubmitButton?.postDelayed({
                    mathSubmitButton?.setBackgroundColor(Color.parseColor("#4CAF50"))
                    generateMathProblem()
                }, 300)
            }
        } else {
            showMathError(getString(R.string.overlay_math_wrong))
            mathAnswerInput?.setText("")
        }
    }

    private fun showMathError(message: String) {
        mathSubmitButton?.setBackgroundColor(Color.parseColor("#F44336"))
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
        mathSubmitButton?.postDelayed({
            mathSubmitButton?.setBackgroundColor(Color.parseColor("#4CAF50"))
        }, 500)
    }

    private fun onTapButtonClicked() {
        tapCount++
        tapCountText?.text = getString(R.string.overlay_tap_progress, tapCount, requiredTaps)

        if (tapCount >= requiredTaps) {
            completeAlarm()
        } else {
            tapButton?.setBackgroundColor(Color.parseColor("#66BB6A"))
            tapButton?.postDelayed({
                tapButton?.setBackgroundColor(Color.parseColor("#4CAF50"))
            }, 100)
        }
    }

    private fun onSnoozeClicked() {
        val db = AlarmDatabase.getInstance(this)

        // Get snooze config from settings
        val (snoozeEnabled, snoozeMaxCount, snoozeDuration) = db.getSnoozeConfig(alarmType)

        // TEMP: Debug logging for settings feature - remove after verification
        AlarmLogger.getInstance(this).d("AlarmOverlay", "TEMP: Snooze clicked - enabled=$snoozeEnabled, maxCount=$snoozeMaxCount, duration=${snoozeDuration}min")

        // Get current snooze count
        val currentSnoozeCount = db.getSnoozeCount(alarmId)
        if (!snoozeEnabled || currentSnoozeCount >= snoozeMaxCount) {
            Toast.makeText(this, getString(R.string.overlay_snooze_max_reached), Toast.LENGTH_SHORT).show()
            return
        }

        val newSnoozeCount = currentSnoozeCount + 1
        val snoozeMs = snoozeDuration * 60 * 1000L
        val snoozeTime = System.currentTimeMillis() + snoozeMs
        val snoozeId = UUID.randomUUID().toString()

        // TEMP: Log snooze scheduling
        AlarmLogger.getInstance(this).d("AlarmOverlay", "TEMP: Scheduling snooze #$newSnoozeCount for ${snoozeDuration}min (${snoozeMs}ms)")

        // Build snooze title
        val baseTitle = title.replace(Regex("\\s*\\(Snoozed \\d+/\\d+\\)$"), "")
        val snoozeTitle = "$baseTitle (Snoozed $newSnoozeCount/$snoozeMaxCount)"

        // Stop current alarm effects
        val audioManager = AlarmAudioManager.getInstance(this)
        audioManager.stopAll()

        // Clear pending challenge and mark original as completed
        db.clearPendingChallenge()
        db.markCompleted(alarmId)

        // Schedule snooze alarm
        val scheduler = AlarmScheduler(this)
        scheduler.scheduleAlarm(snoozeId, snoozeTime, alarmType, snoozeTitle, "beep", newSnoozeCount)

        // Add to snooze queue for JS to sync state
        db.addToSnoozeQueue(
            originalAlarmId = alarmId,
            snoozeAlarmId = snoozeId,
            alarmType = alarmType,
            title = snoozeTitle,
            snoozeCount = newSnoozeCount,
            snoozeEndTime = snoozeTime.toDouble()
        )

        // Stop services
        AlarmService.stop(this)
        val nm = getSystemService(NotificationManager::class.java)
        nm.cancel(AlarmNotificationManager.NOTIFICATION_ID)

        removeOverlay()

        // Open app so it can update Live Activity (optional, user can kill)
        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("dev.nedaa.app://alarm?alarmId=$alarmId&alarmType=$alarmType&action=snooze")
                component = ComponentName(packageName, "$packageName.MainActivity")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            startActivity(intent)
        } catch (_: Exception) {}

        stopSelf()
    }

    private fun completeAlarm() {
        val audioManager = AlarmAudioManager.getInstance(this)
        audioManager.stopAll()

        val db = AlarmDatabase.getInstance(this)
        db.addToCompletedQueue(alarmId, alarmType, title)
        db.clearPendingChallenge()
        db.markCompleted(alarmId)

        AlarmService.stop(this)

        val nm = getSystemService(NotificationManager::class.java)
        nm.cancel(AlarmNotificationManager.NOTIFICATION_ID)

        removeOverlay()

        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("dev.nedaa.app://alarm?alarmId=$alarmId&alarmType=$alarmType&action=complete")
                component = ComponentName(packageName, "$packageName.MainActivity")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            startActivity(intent)
        } catch (_: Exception) {}

        stopSelf()
    }

    private fun removeOverlay() {
        try {
            overlayView?.let {
                windowManager?.removeView(it)
                overlayView = null
            }
        } catch (_: Exception) {}
    }
}
