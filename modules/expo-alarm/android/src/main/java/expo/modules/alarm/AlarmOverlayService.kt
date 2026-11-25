package expo.modules.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.database.SQLException
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.util.UUID

class AlarmOverlayService : Service() {

    companion object {

        // How long past the re-ring the overlay waits before sounding itself.
        private const val QUIET_LATE_MS = 10_000L

        @Volatile
        var isRunning = false
            private set

        // The running quiet's re-ring id; null while no quiet runs.
        @Volatile
        private var quietRingId: String? = null

        // The solved panel outlives the ring; a stopped ring leaves it up.
        @Volatile
        var solvedShowing = false
            private set

        // With draw-over-apps, this overlay draws each ringing alarm.
        fun usesNativeOverlay(context: Context): Boolean = Settings.canDrawOverlays(context)

        fun start(context: Context, alarmId: String, alarmType: String, title: String) {
            if (!usesNativeOverlay(context)) return
            if (!EmergencyQuiet.reachesOverlay(isRunning, quietRingId, alarmId)) return

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

        // The ring's end, which leaves a shown solved panel for its Close.
        fun stopRinging(context: Context) {
            if (!solvedShowing) stop(context)
        }
    }

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null

    private var alarmId: String = ""
    private var alarmType: String = ""
    private var title: String = ""

    // An alarm with no task: a start gate, then its dismiss.
    private var startSolvingContainer: LinearLayout? = null
    private var challengeContainer: LinearLayout? = null

    // A stack NativeBoards.runsShell takes runs the task shell instead.
    private var stack: List<WakeTasks.Task> = emptyList()
    private var taskShell: TaskShellView? = null
    private var card: LinearLayout? = null
    private var header: RingingHeaderView? = null
    private var snoozeSlot: View? = null
    private var lastStartId = 0
    private var shellRunning = false

    // The emergency quiet, as JS useAlarmScreen's emergency control.
    private var quietView: EmergencyQuietView? = null
    private var quietBanner: QuietBannerView? = null
    private var ringBannerSlot: FrameLayout? = null
    private var ringOfferSlot: FrameLayout? = null
    private var quietConfirming = false
    private var quietFailed = false
    private var quieting = false
    // When the alarm rings again; null while no quiet runs.
    private var quietUntil: Long? = null
    private val quietHandler = Handler(Looper.getMainLooper())

    // As JS: the ring screen gives way to the task and comes back on Back.
    private val shellListener = object : TaskShellView.Listener {
        override fun onStart() {
            shellRunning = true
            header?.hide()
            moveQuiet()
            renderQuiet()
        }

        override fun onBack() {
            shellRunning = false
            header?.show()
            moveQuiet()
            renderQuiet()
        }

        override fun onSilence() = silenceAlarm()
        override fun onSound() = soundAtVolume()
        override fun onSolved() = completeAlarm()
        override fun onStop() = completeAlarm(AlarmDatabase.OUTCOME_STOPPED)
        override fun onWayOut() = renderQuiet()
        override fun onTyping(typing: Boolean) = takeTyping(typing)
    }

    private val quietListener = object : EmergencyQuietView.Listener {
        override fun onOpen() {
            quietConfirming = true
            quietFailed = false
            renderQuiet()
        }

        override fun onBack() {
            quietConfirming = false
            quietFailed = false
            renderQuiet()
        }

        override fun onConfirm() = startQuiet()
    }

    // The sound a late quiet re-ring and the shell's quiet end play.
    private var alarmSound: String = "beep"
    private var alarmVolume: Float = 1.0f
    private var gentleWakeUpEnabled: Boolean = false
    private var gentleWakeUpDuration: Int = 3
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
        lastStartId = startId
        // A new ring replaces a shown solved panel.
        if (solvedShowing) closeSolved(stopService = false)
        // A second start keeps the shell showing and its progress; the ringing alarm's notice stays.
        if (taskShell != null) {
            // The quiet's re-ring: AlarmService has started the sound.
            if (intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_ID) == alarmId) endQuiet(sound = false)
            startForeground(AlarmNotificationManager.OVERLAY_NOTIFICATION_ID, createNotification())
            return START_NOT_STICKY
        }

        alarmId = intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_ID) ?: ""
        alarmType = intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_TYPE) ?: ""
        title = intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_TITLE) ?: "Alarm"

        loadChallengeSettings()
        loadSoundSettings()

        AlarmNotificationManager(this).createOverlayChannel()
        startForeground(AlarmNotificationManager.OVERLAY_NOTIFICATION_ID, createNotification())
        showOverlay()
        return START_NOT_STICKY
    }

    private fun loadChallengeSettings() {
        stack = AlarmDatabase.getInstance(this).getAlarmSettings(alarmType).tasks
        AlarmLogger.getInstance(this).d("AlarmOverlay", "Wake-up tasks: ${WakeTasks.encode(stack)}")
    }

    private fun loadSoundSettings() {
        val db = AlarmDatabase.getInstance(this)
        val settings = db.getAlarmSettings(alarmType)
        alarmSound = settings.sound.ifEmpty { "beep" }
        alarmVolume = settings.volume
        gentleWakeUpEnabled = settings.gentleWakeUpEnabled
        gentleWakeUpDuration = settings.gentleWakeUpDuration
        vibrationEnabled = settings.vibrationEnabled
        vibrationPattern = settings.vibrationPattern
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        AlarmScheduler(this).rearmUnsolvedAlarm(alarmId)
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        releaseQuiet()
        taskShell?.release()
        removeOverlay()
        isRunning = false
        solvedShowing = false
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // --- Sound ---

    private fun silenceAlarm() {
        val audioManager = AlarmAudioManager.getInstance(this)
        audioManager.stopAlarmSound()
        audioManager.stopVibration()
    }

    // The shell's sound after quiet time: the set volume at once, as the JS task does.
    private fun soundAtVolume() {
        if (quietUntil != null) return
        val audioManager = AlarmAudioManager.getInstance(this)
        audioManager.startAlarmSound(alarmSound, alarmVolume, false, 0)
        if (vibrationEnabled) {
            audioManager.startVibration(vibrationPattern)
        }
    }

    // --- Notification ---

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

        val contentText = if (NativeBoards.runsShell(stack)) {
            resources.getQuantityString(R.plurals.overlay_task_start_count, stack.size, stack.size)
        } else {
            getString(R.string.overlay_notification_dismiss)
        }

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, AlarmNotificationManager.OVERLAY_CHANNEL_ID)
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

        // Read from the row, so a snooze, a redelivered start or a restart shows the same time.
        val moment = AlarmDatabase.getInstance(this).getAlarm(alarmId)?.moment
        header = RingingHeaderView(this, RingingScreen.typeOf(alarmType), moment).also { card.addView(it.view) }

        if (NativeBoards.runsShell(stack)) {
            ringBannerSlot = quietSlot(this).also { card.addView(it) }
            taskShell = TaskShellView(this, stack, shellListener).also { card.addView(it.view) }
        } else {
            buildDismissUI(card, dp)
        }

        val db = AlarmDatabase.getInstance(this)
        val (snoozeEnabled, snoozeMaxCount, snoozeDurationMinutes) = db.getSnoozeConfig(alarmType)
        val snoozeUse = RingingScreen.SnoozeUse(snoozeEnabled, db.getSnoozeCount(alarmId), snoozeMaxCount)
        AlarmLogger.getInstance(this).d("AlarmOverlay", "Snooze settings - $snoozeUse, duration=$snoozeDurationMinutes")
        snoozeSlot = SnoozeSlotView(this, snoozeUse, snoozeDurationMinutes) { onSnoozeClicked() }.view
        card.addView(snoozeSlot)
        if (taskShell != null) buildQuiet(card, db)
        this.card = card

        rootLayout.addView(card)
        // Scrolls when the card is taller than the screen, as with the keyboard open; centred when it fits.
        val scroller = ScrollView(this).apply {
            isFillViewport = true
            setBackgroundColor(Color.parseColor(COLOR_BG))
            addView(
                rootLayout,
                FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT),
            )
        }
        overlayView = scroller

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
        }

        val windowFlags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            layoutType,
            windowFlags,
            PixelFormat.TRANSLUCENT
        )
        params.gravity = Gravity.CENTER
        // Shrinks above the keyboard; the scroller keeps the focused field in view.
        params.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE

        try {
            windowManager?.addView(overlayView, params)
            header?.announce()
            taskShell?.focusStart()
        } catch (e: Exception) {
            AlarmLogger.getInstance(this).w("AlarmOverlay", "showOverlay addView failed: ${e.message}")
            // A running service with no view would refuse the banner tap.
            stopSelf()
        }
    }

    // An alarm with no task: a "Start Solving" gate, then its dismiss.
    private fun buildDismissUI(card: LinearLayout, dp: Float) {
        startSolvingContainer = buildStartSolvingUI(dp)
        card.addView(startSolvingContainer)

        challengeContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            visibility = View.GONE
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
        buildDirectDismissUI(challengeContainer!!, dp)
        card.addView(challengeContainer)
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

        val instruction = TextView(this).apply {
            text = getString(R.string.overlay_dismiss_instruction)
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
            setTextColor(Color.parseColor(COLOR_TEXT_ON_ACCENT))
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
        startSolvingContainer?.visibility = View.GONE
        challengeContainer?.visibility = View.VISIBLE
        AlarmLogger.getInstance(this).d("AlarmOverlay", "Challenge started by user")
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
            setTextColor(Color.parseColor(COLOR_TEXT_ON_ACCENT))
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

    // --- Snooze & Complete ---

    private fun onSnoozeClicked() {
        if (!EmergencyQuiet.canSnooze(snoozeOpen = true, quietUntil = quietUntil)) return
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

        val snoozeTitle = AlarmCopy.snoozedTitle(this, title, newSnoozeCount, snoozeMaxCount)

        // The replacement is secured first; a failed snooze leaves this alarm ringing.
        val scheduler = AlarmScheduler(this)
        val record = db.getAlarm(alarmId)
        val quietUsed = record?.quietUsed == true
        val scheduled = scheduler.scheduleAlarm(
            snoozeId, snoozeTime, alarmType, snoozeTitle, alarmSound, newSnoozeCount,
            quietUsed = quietUsed, preview = record?.preview == true, moment = record?.moment,
        )
        if (!scheduled) {
            AlarmLogger.getInstance(this).e("AlarmOverlay", "Snooze scheduling failed; alarm keeps ringing: id=$alarmId")
            return
        }

        // Without its queue row the app cannot cancel the snooze, so none is set.
        try {
            db.addToSnoozeQueue(
                originalAlarmId = alarmId,
                snoozeAlarmId = snoozeId,
                alarmType = alarmType,
                title = snoozeTitle,
                snoozeCount = newSnoozeCount,
                snoozeEndTime = snoozeTime.toDouble(),
                quietUsed = quietUsed
            )
        } catch (e: SQLException) {
            scheduler.cancelAlarm(snoozeId)
            runCatching { db.deleteAlarm(snoozeId) }
            AlarmLogger.getInstance(this).e("AlarmOverlay", "Snooze queue save failed; alarm keeps ringing: ${e.message}")
            return
        }

        val audioManager = AlarmAudioManager.getInstance(this)
        audioManager.stopAll()

        db.clearPendingChallenge(alarmId)
        db.markCompleted(alarmId)
        // Also removes the abandoned-challenge re-arm scheduled under this id.
        scheduler.cancelAlarm(alarmId)

        AlarmService.stop(this)
        val nm = getSystemService(NotificationManager::class.java)
        nm.cancel(AlarmNotificationManager.NOTIFICATION_ID)

        releaseQuiet()
        taskShell?.release()
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

    private fun completeAlarm(outcome: String = AlarmDatabase.OUTCOME_SOLVED) {
        releaseQuiet()
        taskShell?.release()

        val audioManager = AlarmAudioManager.getInstance(this)
        audioManager.stopAll()

        val db = AlarmDatabase.getInstance(this)
        db.addToCompletedQueue(alarmId, alarmType, title, outcome)
        db.clearPendingChallenge(alarmId)
        db.markCompleted(alarmId)

        // Drops any re-arm placed by onTaskRemoved during this challenge.
        AlarmScheduler(this).cancelAlarm(alarmId)

        val solved = outcome == AlarmDatabase.OUTCOME_SOLVED
        // Set before the ring stops, so AlarmService leaves the panel up.
        if (solved && RingingScreen.solvedShowsPanel(stack)) {
            solvedShowing = true
            isRunning = false
        }

        AlarmService.stop(this)

        val nm = getSystemService(NotificationManager::class.java)
        nm.cancel(AlarmNotificationManager.NOTIFICATION_ID)

        when {
            solvedShowing -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                showSolved()
            }
            solved -> closeSolved(stopService = true)
            else -> {
                removeOverlay()
                openApp()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
    }

    // A stopped alarm opens the app, as snooze does.
    private fun openApp() {
        try {
            val intent = Intent(this, Class.forName("$packageName.MainActivity")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            startActivity(intent)
        } catch (e: Exception) {
            AlarmLogger.getInstance(this).d("AlarmOverlay", "completeAlarm startActivity failed: ${e.message}")
        }
    }

    // As JS: the panel stands where the task was, and the screen may sleep.
    private fun showSolved() {
        val panel = SolvedPanelView(this) { closeSolved(stopService = true) }
        header?.hide()
        snoozeSlot?.visibility = View.GONE
        // Only a ring with a task shows the panel, so the shell is there.
        taskShell?.showSolved(panel.view)
        updateWindow { it.flags = it.flags and WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON.inv() }
        panel.shown()
    }

    // Ends the panel; a new ring keeps the service and draws afresh.
    private fun closeSolved(stopService: Boolean) {
        solvedShowing = false
        removeOverlay()
        resetRing()
        if (stopService) {
            // The app drains the completed queue when it comes to the front.
            openApp()
            stopForeground(STOP_FOREGROUND_REMOVE)
            // A ring that started after the last one seen keeps the service.
            stopSelfResult(lastStartId)
        } else {
            isRunning = true
        }
    }

    // The state one ring leaves, cleared so the next draws as new.
    private fun resetRing() {
        shellRunning = false
        quietView = null
        quietBanner = null
        ringBannerSlot = null
        ringOfferSlot = null
        quietConfirming = false
        quietFailed = false
        quieting = false
        quietUntil = null
        taskShell = null
        card = null
        header = null
        snoozeSlot = null
        startSolvingContainer = null
        challengeContainer = null
    }

    // --- Emergency quiet ---

    // A restarted overlay picks up a quiet whose re-ring is still ahead.
    private fun buildQuiet(card: LinearLayout, db: AlarmDatabase) {
        quietBanner = QuietBannerView(this)
        quietView = EmergencyQuietView(this, quietListener)
        ringOfferSlot = quietSlot(this).also { card.addView(it) }
        moveQuiet()
        val record = db.getAlarm(alarmId)
        val now = System.currentTimeMillis()
        val until = record?.let {
            EmergencyQuiet.runningQuietEnd(alarmId, alarmType, it.triggerTime.toLong(), it.quietUsed, now)
        }
        if (until != null) holdQuiet(until, now)
        renderQuiet()
    }

    // The ring screen's slots, or the open run's.
    private fun moveQuiet() {
        val shell = taskShell ?: return
        val bannerSlot = if (shellRunning) shell.bannerSlot else ringBannerSlot
        val offerSlot = if (shellRunning) shell.offerSlot else ringOfferSlot
        bannerSlot?.let { quietBanner?.view?.moveTo(it) }
        offerSlot?.let { quietView?.view?.moveTo(it) }
    }

    // As JS useQuietOffer, read from the alarm database at each change.
    private fun renderQuiet() {
        val shell = taskShell ?: return
        val view = quietView ?: return
        val db = AlarmDatabase.getInstance(this)
        val record = db.getAlarm(alarmId)
        val saved = db.quietLedgerOrNull()
        val ledger = saved ?: EmergencyQuiet.NEW_LEDGER
        val now = System.currentTimeMillis()
        // Until the app writes the ledger no allowance is known, so it reads as off.
        val allowance = if (saved == null) EmergencyQuiet.ALLOWANCE_OFF else EmergencyQuiet.allowanceInEffect(ledger, now)
        val offer = EmergencyQuiet.offerFor(
            EmergencyQuiet.OfferInput(
                hasTask = true,
                preview = record?.preview == true,
                snoozed = false,
                wayOut = shell.wayOutShown,
                used = record?.quietUsed == true,
                quietUntil = quietUntil,
                allowance = allowance,
                left = if (saved == null) 0 else EmergencyQuiet.usesLeft(ledger, now),
            )
        )
        val confirmOpen = EmergencyQuiet.confirmOpen(quietConfirming, offer)
        view.show(QuietShown(offer, confirmOpen, quietFailed, quieting, EmergencyQuiet.refillDate(ledger, now)))
        quietUntil?.let { quietBanner?.show(it) }
        shell.setQuiet(heard = quietUntil == null, confirmOpen = confirmOpen)
        // The confirm stands in snooze's place; a running quiet holds none.
        val snoozeShown = EmergencyQuiet.canSnooze(!shellRunning && !confirmOpen, quietUntil)
        snoozeSlot?.visibility = if (snoozeShown) View.VISIBLE else View.GONE
    }

    // The re-ring is armed first; a failed save cancels it and counts nothing.
    private fun startQuiet() {
        if (quieting || quietUntil != null) return
        quieting = true
        renderQuiet()
        val db = AlarmDatabase.getInstance(this)
        val record = db.getAlarm(alarmId)
        val now = System.currentTimeMillis()
        val ringsAt = EmergencyQuiet.quietEndsAt(now)
        val quietId = EmergencyQuiet.quietIdFor(alarmType, ringsAt)
        val snoozeCount = record?.snoozeCount ?: 0
        val scheduler = AlarmScheduler(this)
        // The count and the hand-over to the re-ring are saved together or not at all.
        val counted = try {
            scheduler.scheduleAlarm(
                quietId, ringsAt, alarmType, title, alarmSound, snoozeCount,
                quietUsed = true, preview = record?.preview == true, moment = record?.moment,
            ) && db.recordQuietUse(now) {
                db.markCompleted(alarmId)
                // The re-ring owns the ring, so it is not deferred behind this alarm.
                db.setPendingChallenge(quietId, alarmType, title)
                db.addToSnoozeQueue(
                    originalAlarmId = alarmId,
                    snoozeAlarmId = quietId,
                    alarmType = alarmType,
                    title = title,
                    snoozeCount = snoozeCount,
                    snoozeEndTime = ringsAt.toDouble(),
                    quietUsed = true
                )
            } != null
        } catch (e: SQLException) {
            AlarmLogger.getInstance(this).e("AlarmOverlay", "Quiet save failed: ${e.message}")
            false
        }
        quieting = false
        if (!counted) {
            scheduler.cancelAlarm(quietId)
            runCatching { db.deleteAlarm(quietId) }
            AlarmLogger.getInstance(this).w("AlarmOverlay", "Quiet failed: id=$alarmId")
            quietFailed = true
            renderQuiet()
            return
        }
        scheduler.cancelAlarm(alarmId)
        AlarmLogger.getInstance(this).d("AlarmOverlay", "Quiet until $ringsAt: $alarmId -> $quietId")
        alarmId = quietId
        quietConfirming = false
        holdQuiet(ringsAt, now)
        startForeground(AlarmNotificationManager.OVERLAY_NOTIFICATION_ID, createNotification())
        renderQuiet()
    }

    // The sound stops until the re-ring; the overlay sounds it if that is late.
    private fun holdQuiet(until: Long, now: Long) {
        quietUntil = until
        quietRingId = alarmId
        silenceAlarm()
        header?.breathing = false
        quietHandler.removeCallbacksAndMessages(null)
        quietHandler.postDelayed({ endQuiet(sound = true) }, until - now + QUIET_LATE_MS)
    }

    private fun endQuiet(sound: Boolean) {
        if (quietUntil == null) return
        quietHandler.removeCallbacksAndMessages(null)
        quietUntil = null
        quietRingId = null
        header?.breathing = true
        quietBanner?.hide()
        if (sound) ringLate()
        renderQuiet()
    }

    // The late re-ring rings through AlarmService, as an on-time one does:
    // the gentle wake-up, the service's ringing id and a fresh pending row.
    private fun ringLate() {
        AlarmScheduler(this).cancelAlarm(alarmId)
        try {
            AlarmDatabase.getInstance(this).setPendingChallenge(alarmId, alarmType, title)
        } catch (e: SQLException) {
            AlarmLogger.getInstance(this).e("AlarmOverlay", "Pending challenge save failed: ${e.message}")
        }
        AlarmService.start(this, alarmId, alarmType, title, alarmSound)
    }

    private fun releaseQuiet() {
        quietRingId = null
        quietHandler.removeCallbacksAndMessages(null)
        quietView?.release()
    }

    // The window takes focus, and so the keyboard, only while a board types.
    private fun takeTyping(typing: Boolean) {
        if (!typing) {
            overlayView?.let {
                getSystemService(InputMethodManager::class.java)?.hideSoftInputFromWindow(it.windowToken, 0)
            }
        }
        updateWindow { params ->
            params.flags = if (typing) {
                params.flags and WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE.inv()
            } else {
                params.flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
            }
        }
    }

    private fun updateWindow(change: (WindowManager.LayoutParams) -> Unit) {
        val view = overlayView ?: return
        val params = view.layoutParams as? WindowManager.LayoutParams ?: return
        change(params)
        try {
            windowManager?.updateViewLayout(view, params)
        } catch (e: IllegalArgumentException) {
            AlarmLogger.getInstance(this).w("AlarmOverlay", "updateViewLayout failed: ${e.message}")
        }
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
