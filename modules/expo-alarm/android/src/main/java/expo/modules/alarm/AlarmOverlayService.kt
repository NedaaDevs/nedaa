package expo.modules.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.text.InputType
import android.text.TextWatcher
import android.text.Editable
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import java.util.UUID
import kotlin.random.Random

class AlarmOverlayService : Service() {

    companion object {
        private const val NOTIFICATION_ID = 9002
        private const val CHANNEL_ID = "alarm_overlay_channel"

        // Tap counts per difficulty
        private const val TAPS_EASY = 5
        private const val TAPS_MEDIUM = 10
        private const val TAPS_HARD = 20

        // Grace period seconds (must match JS GRACE_PERIOD_SECONDS)
        private val GRACE_TAP = mapOf("easy" to 10, "medium" to 15, "hard" to 20)
        private val GRACE_MATH = mapOf("easy" to 15, "medium" to 20, "hard" to 30)

        // UI colors
        private const val COLOR_BG = "#F0111827"
        private const val COLOR_CARD_BG = "#FF1E293B"
        private const val COLOR_PRIMARY = "#FF6366F1"
        private const val COLOR_PRIMARY_LIGHT = "#FF818CF8"
        private const val COLOR_SUCCESS = "#FF22C55E"
        private const val COLOR_SUCCESS_LIGHT = "#FF4ADE80"
        private const val COLOR_WARNING = "#FFFBBF24"
        private const val COLOR_ERROR = "#FFEF4444"
        private const val COLOR_SNOOZE = "#FFF59E0B"
        private const val COLOR_TEXT = "#FFFFFFFF"
        private const val COLOR_TEXT_MUTED = "#FF94A3B8"
        private const val COLOR_INPUT_BG = "#FF334155"
        private const val COLOR_DISABLED = "#FF475569"

        private const val GRACE_UPDATE_INTERVAL_MS = 50L
        private const val AUTO_SNOOZE_TIMEOUT_MS = 15 * 60 * 1000L

        @Volatile
        var isRunning = false
            private set

        fun start(context: Context, alarmId: String, alarmType: String, title: String) {
            if (!Settings.canDrawOverlays(context)) return
            if (isRunning) return

            val intent = Intent(context, AlarmOverlayService::class.java).apply {
                putExtra(AlarmReceiver.EXTRA_ALARM_ID, alarmId)
                putExtra(AlarmReceiver.EXTRA_ALARM_TYPE, alarmType)
                putExtra(AlarmReceiver.EXTRA_ALARM_TITLE, title)
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
    private var challengeStarted = false
    private var startSolvingContainer: LinearLayout? = null
    private var challengeContainer: LinearLayout? = null

    // Tap challenge state
    private var tapCount = 0
    private var tapsPerRound: Int = TAPS_EASY
    private var tapRoundsCompleted: Int = 0
    private var tapButton: Button? = null
    private var tapCountText: TextView? = null

    // Math challenge state
    private var mathProblemText: TextView? = null
    private var mathAnswerInput: EditText? = null
    private var mathSubmitButton: Button? = null
    private var mathProgressText: TextView? = null
    private var currentMathAnswer: Int = 0
    private var completedMathChallenges: Int = 0

    private var autoSnoozeRunnable: Runnable? = null

    // Grace period state
    private var graceProgressBar: ProgressBar? = null
    private var graceExpiredText: TextView? = null
    private var graceDurationMs: Long = 0
    private var graceStartTime: Long = 0
    private var graceActive = false
    private var graceExpired = false
    private var graceTimerRunning = false
    private val graceHandler = Handler(Looper.getMainLooper())
    private val graceRunnable = object : Runnable {
        override fun run() {
            if (!graceActive) return
            val elapsed = System.currentTimeMillis() - graceStartTime
            val remaining = graceDurationMs - elapsed
            if (remaining <= 0) {
                onGraceExpired()
            } else {
                val progress = ((remaining.toFloat() / graceDurationMs) * 10000).toInt()
                graceProgressBar?.progress = progress
                updateGraceBarColor(remaining.toFloat() / graceDurationMs)
                graceHandler.postDelayed(this, GRACE_UPDATE_INTERVAL_MS)
            }
        }
    }

    // Settings for restarting sound after grace
    private var alarmSound: String = "beep"
    private var alarmVolume: Float = 1.0f
    private var vibrationEnabled: Boolean = true
    private var vibrationPattern: String = "default"

    override fun onCreate() {
        super.onCreate()
        isRunning = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        alarmId = intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_ID) ?: ""
        alarmType = intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_TYPE) ?: ""
        title = intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_TITLE) ?: "Alarm"

        loadChallengeSettings()
        loadSoundSettings()

        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        showOverlay()
        startAutoSnoozeTimeout()

        return START_NOT_STICKY
    }

    private fun loadChallengeSettings() {
        val db = AlarmDatabase.getInstance(this)
        val (type, difficulty, count) = db.getChallengeConfig(alarmType)
        challengeType = type
        challengeDifficulty = difficulty
        challengeCount = count

        tapsPerRound = when (difficulty) {
            "easy" -> TAPS_EASY
            "medium" -> TAPS_MEDIUM
            "hard" -> TAPS_HARD
            else -> TAPS_EASY
        }
        requiredTaps = tapsPerRound * count

        // Calculate grace period
        graceDurationMs = when (type) {
            "tap" -> (GRACE_TAP[difficulty] ?: 10) * 1000L
            "math" -> (GRACE_MATH[difficulty] ?: 15) * 1000L
            else -> 0L
        }

        AlarmLogger.getInstance(this).d("AlarmOverlay", "Challenge settings: type=$challengeType, difficulty=$challengeDifficulty, count=$challengeCount, requiredTaps=$requiredTaps, graceDuration=${graceDurationMs}ms")
    }

    private fun loadSoundSettings() {
        val db = AlarmDatabase.getInstance(this)
        val settings = db.getAlarmSettings(alarmType)
        alarmSound = settings.sound.ifEmpty { "beep" }
        alarmVolume = settings.volume
        vibrationEnabled = settings.vibrationEnabled
        vibrationPattern = settings.vibrationPattern
    }

    override fun onDestroy() {
        graceHandler.removeCallbacksAndMessages(null)
        removeOverlay()
        isRunning = false
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // --- Grace Period ---

    private fun onInteraction() {
        if (graceDurationMs <= 0) return

        // Reset the countdown
        graceStartTime = System.currentTimeMillis()
        graceProgressBar?.progress = 10000
        graceProgressBar?.visibility = View.VISIBLE

        // If expired, silence alarm again
        if (graceExpired) {
            graceExpired = false
            graceExpiredText?.visibility = View.GONE
            val audioManager = AlarmAudioManager.getInstance(this)
            audioManager.stopAlarmSound()
            audioManager.stopVibration()
        }

        graceActive = true

        // Only start the interval loop once
        if (!graceTimerRunning) {
            graceTimerRunning = true

            // Silence alarm on first interaction
            val audioManager = AlarmAudioManager.getInstance(this)
            audioManager.stopAlarmSound()
            audioManager.stopVibration()

            graceHandler.post(graceRunnable)
            AlarmLogger.getInstance(this).d("AlarmOverlay", "Grace period started: ${graceDurationMs}ms")
        }
    }

    private fun onGraceExpired() {
        graceActive = false
        graceExpired = true
        graceTimerRunning = false
        graceHandler.removeCallbacksAndMessages(null)

        graceProgressBar?.progress = 0
        updateGraceBarColor(0f)
        graceExpiredText?.visibility = View.VISIBLE

        // Restart alarm sound
        val audioManager = AlarmAudioManager.getInstance(this)
        audioManager.startAlarmSound(alarmSound, alarmVolume)
        if (vibrationEnabled) {
            audioManager.startVibration(vibrationPattern)
        }

        startAutoSnoozeTimeout()
        AlarmLogger.getInstance(this).d("AlarmOverlay", "Grace period expired, sound restarted")
    }

    private fun resetGraceForNextRound() {
        graceHandler.removeCallbacksAndMessages(null)
        graceActive = false
        graceExpired = false
        graceTimerRunning = false
        graceStartTime = 0
        graceProgressBar?.visibility = View.GONE
        graceProgressBar?.progress = 10000
        graceExpiredText?.visibility = View.GONE

        // User already started solving — keep challenge visible, restart grace on next interaction
        startAutoSnoozeTimeout()
    }

    private fun updateGraceBarColor(fraction: Float) {
        val color = when {
            fraction > 0.30f -> Color.parseColor(COLOR_PRIMARY)
            fraction > 0.10f -> Color.parseColor(COLOR_WARNING)
            else -> Color.parseColor(COLOR_ERROR)
        }
        graceProgressBar?.progressTintList = ColorStateList.valueOf(color)
    }

    // --- Notification ---

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

    // --- Overlay UI ---

    private fun showOverlay() {
        if (!Settings.canDrawOverlays(this)) {
            stopSelf()
            return
        }

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        val dp = resources.displayMetrics.density

        val rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor(COLOR_BG))
            setPadding((24 * dp).toInt(), (48 * dp).toInt(), (24 * dp).toInt(), (48 * dp).toInt())
        }

        // Card container
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            background = GradientDrawable().apply {
                setColor(Color.parseColor(COLOR_CARD_BG))
                cornerRadius = 24 * dp
            }
            setPadding((28 * dp).toInt(), (32 * dp).toInt(), (28 * dp).toInt(), (32 * dp).toInt())
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            layoutParams = params
        }

        // Title
        val titleView = TextView(this).apply {
            text = title
            textSize = 28f
            setTextColor(Color.parseColor(COLOR_TEXT))
            gravity = Gravity.CENTER
            typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
            setPadding(0, 0, 0, (8 * dp).toInt())
        }
        card.addView(titleView)

        // Grace period progress bar (hidden initially, shown on first interaction)
        graceProgressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 10000
            progress = 10000
            progressTintList = ColorStateList.valueOf(Color.parseColor(COLOR_PRIMARY))
            progressBackgroundTintList = ColorStateList.valueOf(Color.parseColor("#33FFFFFF"))
            visibility = View.GONE
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                (4 * dp).toInt()
            ).apply {
                topMargin = (8 * dp).toInt()
                bottomMargin = (4 * dp).toInt()
            }
            layoutParams = params
        }
        card.addView(graceProgressBar)

        // Grace expired text (hidden initially)
        graceExpiredText = TextView(this).apply {
            text = getString(R.string.overlay_grace_expired)
            textSize = 12f
            setTextColor(Color.parseColor(COLOR_ERROR))
            gravity = Gravity.CENTER
            visibility = View.GONE
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = (8 * dp).toInt() }
            layoutParams = params
        }
        card.addView(graceExpiredText)

        // "Start Solving" gate (shown initially)
        startSolvingContainer = buildStartSolvingUI(dp)
        card.addView(startSolvingContainer)

        // Challenge-specific UI (hidden until Start Solving pressed)
        challengeContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            visibility = View.GONE
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
        when (challengeType) {
            "math" -> buildMathChallengeUI(challengeContainer!!, dp)
            "none" -> buildDirectDismissUI(challengeContainer!!, dp)
            else -> buildTapChallengeUI(challengeContainer!!, dp)
        }
        card.addView(challengeContainer)

        // Snooze button
        val db = AlarmDatabase.getInstance(this)
        val (snoozeEnabled, snoozeMaxCount, snoozeDurationMinutes) = db.getSnoozeConfig(alarmType)
        val currentSnoozeCount = db.getSnoozeCount(alarmId)
        val remainingSnoozes = snoozeMaxCount - currentSnoozeCount
        val canSnooze = snoozeEnabled && remainingSnoozes > 0

        AlarmLogger.getInstance(this).d("AlarmOverlay", "Snooze settings - enabled=$snoozeEnabled, maxCount=$snoozeMaxCount, duration=$snoozeDurationMinutes, current=$currentSnoozeCount, remaining=$remainingSnoozes")

        if (snoozeEnabled) {
            val snoozeButton = Button(this).apply {
                text = if (canSnooze) getString(R.string.overlay_snooze_button, remainingSnoozes) else getString(R.string.overlay_snooze_none)
                textSize = 15f
                isAllCaps = false
                setTextColor(if (canSnooze) Color.parseColor(COLOR_TEXT) else Color.parseColor(COLOR_TEXT_MUTED))
                background = GradientDrawable().apply {
                    if (canSnooze) {
                        setColor(Color.parseColor(COLOR_SNOOZE))
                    } else {
                        setColor(Color.parseColor(COLOR_DISABLED))
                    }
                    cornerRadius = 12 * dp
                }
                setPadding((24 * dp).toInt(), (14 * dp).toInt(), (24 * dp).toInt(), (14 * dp).toInt())
                isEnabled = canSnooze
                val params = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { topMargin = (12 * dp).toInt() }
                layoutParams = params
                setOnClickListener { onSnoozeClicked() }
            }
            card.addView(snoozeButton)
        }

        rootLayout.addView(card)
        overlayView = rootLayout

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
        }

        val windowFlags = if (challengeType == "math") {
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        } else {
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
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
        } catch (e: Exception) {
            AlarmLogger.getInstance(this).d("AlarmOverlay", "showOverlay addView failed: ${e.message}")
        }
    }

    private fun buildStartSolvingUI(dp: Float): LinearLayout {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        val instructionText = when (challengeType) {
            "math" -> if (challengeCount == 1) {
                getString(R.string.overlay_math_instruction_one)
            } else {
                getString(R.string.overlay_math_instruction_many, challengeCount)
            }
            "none" -> getString(R.string.overlay_dismiss_instruction)
            else -> getString(R.string.overlay_tap_instruction, requiredTaps)
        }

        val instruction = TextView(this).apply {
            text = instructionText
            textSize = 15f
            setTextColor(Color.parseColor(COLOR_TEXT_MUTED))
            gravity = Gravity.CENTER
            setPadding(0, (8 * dp).toInt(), 0, (32 * dp).toInt())
        }
        container.addView(instruction)

        val startButton = Button(this).apply {
            text = getString(R.string.overlay_start_solving)
            textSize = 18f
            isAllCaps = false
            setTextColor(Color.parseColor(COLOR_TEXT))
            background = GradientDrawable().apply {
                setColor(Color.parseColor(COLOR_PRIMARY))
                cornerRadius = 16 * dp
            }
            setPadding((24 * dp).toInt(), (18 * dp).toInt(), (24 * dp).toInt(), (18 * dp).toInt())
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            layoutParams = params
            setOnClickListener { onStartSolving() }
        }
        container.addView(startButton)

        return container
    }

    private fun onStartSolving() {
        challengeStarted = true

        // Always silence alarm when user starts solving
        val audioManager = AlarmAudioManager.getInstance(this)
        audioManager.stopAlarmSound()
        audioManager.stopVibration()

        // Start grace timer if configured
        if (graceDurationMs > 0) {
            onInteraction()
        }

        // Swap UI: hide start button, show challenge
        startSolvingContainer?.visibility = View.GONE
        challengeContainer?.visibility = View.VISIBLE

        AlarmLogger.getInstance(this).d("AlarmOverlay", "Challenge started by user")
    }

    private fun buildTapChallengeUI(card: LinearLayout, dp: Float) {
        val subtitleView = TextView(this).apply {
            text = getString(R.string.overlay_tap_instruction, requiredTaps)
            textSize = 15f
            setTextColor(Color.parseColor(COLOR_TEXT_MUTED))
            gravity = Gravity.CENTER
            setPadding(0, (8 * dp).toInt(), 0, (24 * dp).toInt())
        }
        card.addView(subtitleView)

        tapCountText = TextView(this).apply {
            text = getString(R.string.overlay_tap_progress, 0, requiredTaps)
            textSize = 56f
            setTextColor(Color.parseColor(COLOR_TEXT))
            gravity = Gravity.CENTER
            typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
            setPadding(0, 0, 0, (24 * dp).toInt())
        }
        card.addView(tapCountText)

        tapButton = Button(this).apply {
            text = getString(R.string.overlay_tap_button)
            textSize = 18f
            isAllCaps = false
            setTextColor(Color.parseColor(COLOR_TEXT))
            background = GradientDrawable().apply {
                setColor(Color.parseColor(COLOR_SUCCESS))
                cornerRadius = 16 * dp
            }
            setPadding((24 * dp).toInt(), (18 * dp).toInt(), (24 * dp).toInt(), (18 * dp).toInt())
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            layoutParams = params
            setOnClickListener { onTapButtonClicked() }
        }
        card.addView(tapButton)
    }

    private fun buildDirectDismissUI(card: LinearLayout, dp: Float) {
        val subtitleView = TextView(this).apply {
            text = getString(R.string.overlay_dismiss_instruction)
            textSize = 15f
            setTextColor(Color.parseColor(COLOR_TEXT_MUTED))
            gravity = Gravity.CENTER
            setPadding(0, (8 * dp).toInt(), 0, (32 * dp).toInt())
        }
        card.addView(subtitleView)

        val dismissButton = Button(this).apply {
            text = getString(R.string.overlay_dismiss_button)
            textSize = 18f
            isAllCaps = false
            setTextColor(Color.parseColor(COLOR_TEXT))
            background = GradientDrawable().apply {
                setColor(Color.parseColor(COLOR_SUCCESS))
                cornerRadius = 16 * dp
            }
            setPadding((24 * dp).toInt(), (18 * dp).toInt(), (24 * dp).toInt(), (18 * dp).toInt())
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            layoutParams = params
            setOnClickListener { completeAlarm() }
        }
        card.addView(dismissButton)
    }

    private fun buildMathChallengeUI(card: LinearLayout, dp: Float) {
        val subtitleView = TextView(this).apply {
            text = if (challengeCount == 1) {
                getString(R.string.overlay_math_instruction_one)
            } else {
                getString(R.string.overlay_math_instruction_many, challengeCount)
            }
            textSize = 15f
            setTextColor(Color.parseColor(COLOR_TEXT_MUTED))
            gravity = Gravity.CENTER
            setPadding(0, (8 * dp).toInt(), 0, (16 * dp).toInt())
        }
        card.addView(subtitleView)

        if (challengeCount > 1) {
            mathProgressText = TextView(this).apply {
                text = getString(R.string.overlay_math_progress, 1, challengeCount)
                textSize = 13f
                setTextColor(Color.parseColor(COLOR_TEXT_MUTED))
                gravity = Gravity.CENTER
                setPadding(0, 0, 0, (12 * dp).toInt())
            }
            card.addView(mathProgressText)
        }

        // Problem display in a rounded box
        val problemContainer = LinearLayout(this).apply {
            gravity = Gravity.CENTER
            background = GradientDrawable().apply {
                setColor(Color.parseColor(COLOR_INPUT_BG))
                cornerRadius = 16 * dp
            }
            setPadding((24 * dp).toInt(), (20 * dp).toInt(), (24 * dp).toInt(), (20 * dp).toInt())
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = (20 * dp).toInt() }
            layoutParams = params
        }

        mathProblemText = TextView(this).apply {
            textSize = 36f
            setTextColor(Color.parseColor(COLOR_TEXT))
            gravity = Gravity.CENTER
            typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
        }
        problemContainer.addView(mathProblemText)
        card.addView(problemContainer)

        mathAnswerInput = EditText(this).apply {
            hint = getString(R.string.overlay_math_hint)
            textSize = 28f
            setTextColor(Color.parseColor(COLOR_TEXT))
            setHintTextColor(Color.parseColor("#FF64748B"))
            background = GradientDrawable().apply {
                setColor(Color.parseColor(COLOR_INPUT_BG))
                cornerRadius = 12 * dp
            }
            gravity = Gravity.CENTER
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_SIGNED
            imeOptions = EditorInfo.IME_ACTION_DONE
            setPadding((24 * dp).toInt(), (16 * dp).toInt(), (24 * dp).toInt(), (16 * dp).toInt())
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = (16 * dp).toInt() }
            layoutParams = params
            setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_DONE) {
                    onMathAnswerSubmitted()
                    true
                } else {
                    false
                }
            }
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
                override fun afterTextChanged(s: Editable?) {
                    if (!s.isNullOrEmpty()) onInteraction()
                }
            })
        }
        card.addView(mathAnswerInput)

        mathSubmitButton = Button(this).apply {
            text = getString(R.string.overlay_math_submit)
            textSize = 18f
            isAllCaps = false
            setTextColor(Color.parseColor(COLOR_TEXT))
            background = GradientDrawable().apply {
                setColor(Color.parseColor(COLOR_PRIMARY))
                cornerRadius = 16 * dp
            }
            setPadding((24 * dp).toInt(), (18 * dp).toInt(), (24 * dp).toInt(), (18 * dp).toInt())
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            layoutParams = params
            setOnClickListener { onMathAnswerSubmitted() }
        }
        card.addView(mathSubmitButton)

        generateMathProblem()
    }

    // --- Challenge Logic ---

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

        val displayOp = when (op) {
            "-" -> "\u2212"
            "*" -> "\u00D7"
            else -> op
        }

        mathProblemText?.text = "$a $displayOp $b = ?"
        mathAnswerInput?.setText("")
        mathProgressText?.text = getString(R.string.overlay_math_progress, completedMathChallenges + 1, challengeCount)
    }

    private fun onMathAnswerSubmitted() {
        onInteraction()
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
                // Success feedback then next problem
                setButtonColor(mathSubmitButton, COLOR_SUCCESS)
                graceHandler.postDelayed({
                    setButtonColor(mathSubmitButton, COLOR_PRIMARY)
                    resetGraceForNextRound()
                    generateMathProblem()
                }, 300)
            }
        } else {
            showMathError(getString(R.string.overlay_math_wrong))
            mathAnswerInput?.setText("")
        }
    }

    private fun showMathError(message: String) {
        setButtonColor(mathSubmitButton, COLOR_ERROR)
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
        graceHandler.postDelayed({
            setButtonColor(mathSubmitButton, COLOR_PRIMARY)
        }, 500)
    }

    private fun onTapButtonClicked() {
        onInteraction()
        tapCount++
        tapCountText?.text = getString(R.string.overlay_tap_progress, tapCount, requiredTaps)

        if (tapCount >= requiredTaps) {
            completeAlarm()
        } else {
            val nextRoundBoundary = (tapRoundsCompleted + 1) * tapsPerRound
            if (tapCount >= nextRoundBoundary) {
                tapRoundsCompleted++
                setButtonColor(tapButton, COLOR_SUCCESS_LIGHT)
                graceHandler.postDelayed({
                    setButtonColor(tapButton, COLOR_SUCCESS)
                    resetGraceForNextRound()
                }, 200)
            } else {
                setButtonColor(tapButton, COLOR_SUCCESS_LIGHT)
                graceHandler.postDelayed({
                    setButtonColor(tapButton, COLOR_SUCCESS)
                }, 100)
            }
        }
    }

    private fun setButtonColor(button: Button?, colorHex: String) {
        val bg = button?.background
        if (bg is GradientDrawable) {
            bg.setColor(Color.parseColor(colorHex))
        } else {
            button?.setBackgroundColor(Color.parseColor(colorHex))
        }
    }

    // --- Auto-Snooze Timeout ---

    private fun startAutoSnoozeTimeout() {
        cancelAutoSnoozeTimeout()
        autoSnoozeRunnable = Runnable {
            AlarmLogger.getInstance(this).d("AlarmOverlay", "Auto-snooze timeout reached")
            performAutoSnooze()
        }
        graceHandler.postDelayed(autoSnoozeRunnable!!, AUTO_SNOOZE_TIMEOUT_MS)
    }

    private fun cancelAutoSnoozeTimeout() {
        autoSnoozeRunnable?.let { graceHandler.removeCallbacks(it) }
        autoSnoozeRunnable = null
    }

    private fun performAutoSnooze() {
        val db = AlarmDatabase.getInstance(this)
        val (snoozeEnabled, snoozeMaxCount, snoozeDuration) = db.getSnoozeConfig(alarmType)
        val currentSnoozeCount = db.getSnoozeCount(alarmId)

        if (snoozeEnabled && currentSnoozeCount < snoozeMaxCount) {
            scheduleSnooze(db, snoozeMaxCount, snoozeDuration, currentSnoozeCount)
        } else {
            completeAlarm()
        }
    }

    // --- Snooze & Complete ---

    private fun onSnoozeClicked() {
        cancelAutoSnoozeTimeout()

        val db = AlarmDatabase.getInstance(this)
        val (snoozeEnabled, snoozeMaxCount, snoozeDuration) = db.getSnoozeConfig(alarmType)
        val currentSnoozeCount = db.getSnoozeCount(alarmId)

        if (!snoozeEnabled || currentSnoozeCount >= snoozeMaxCount) {
            Toast.makeText(this, getString(R.string.overlay_snooze_max_reached), Toast.LENGTH_SHORT).show()
            return
        }

        scheduleSnooze(db, snoozeMaxCount, snoozeDuration, currentSnoozeCount)
    }

    private fun scheduleSnooze(db: AlarmDatabase, snoozeMaxCount: Int, snoozeDuration: Int, currentSnoozeCount: Int) {
        val newSnoozeCount = currentSnoozeCount + 1
        val snoozeMs = snoozeDuration * 60 * 1000L
        val snoozeTime = System.currentTimeMillis() + snoozeMs
        val snoozeId = UUID.randomUUID().toString()

        val baseTitle = title.replace(Regex("\\s*\\(Snoozed \\d+/\\d+\\)$"), "")
        val snoozeTitle = "$baseTitle (Snoozed $newSnoozeCount/$snoozeMaxCount)"

        val audioManager = AlarmAudioManager.getInstance(this)
        audioManager.stopAll()

        db.clearPendingChallenge()
        db.markCompleted(alarmId)

        val scheduler = AlarmScheduler(this)
        scheduler.scheduleAlarm(snoozeId, snoozeTime, alarmType, snoozeTitle, alarmSound, newSnoozeCount)

        db.addToSnoozeQueue(
            originalAlarmId = alarmId,
            snoozeAlarmId = snoozeId,
            alarmType = alarmType,
            title = snoozeTitle,
            snoozeCount = newSnoozeCount,
            snoozeEndTime = snoozeTime.toDouble()
        )

        AlarmService.stop(this)
        val nm = getSystemService(NotificationManager::class.java)
        nm.cancel(AlarmNotificationManager.NOTIFICATION_ID)

        graceHandler.removeCallbacksAndMessages(null)
        removeOverlay()

        try {
            val intent = Intent(this, Class.forName("$packageName.MainActivity")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            startActivity(intent)
        } catch (e: Exception) {
            AlarmLogger.getInstance(this).d("AlarmOverlay", "scheduleSnooze startActivity failed: ${e.message}")
        }

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun completeAlarm() {
        cancelAutoSnoozeTimeout()
        graceHandler.removeCallbacksAndMessages(null)

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
                data = Uri.parse("dev.nedaa.app://alarm-complete?alarmType=$alarmType")
                component = ComponentName(packageName, "$packageName.MainActivity")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            startActivity(intent)
        } catch (e: Exception) {
            AlarmLogger.getInstance(this).d("AlarmOverlay", "completeAlarm startActivity failed: ${e.message}")
        }

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun removeOverlay() {
        try {
            overlayView?.let {
                windowManager?.removeView(it)
                overlayView = null
            }
        } catch (e: Exception) {
            AlarmLogger.getInstance(this).d("AlarmOverlay", "removeOverlay failed: ${e.message}")
        }
    }
}
