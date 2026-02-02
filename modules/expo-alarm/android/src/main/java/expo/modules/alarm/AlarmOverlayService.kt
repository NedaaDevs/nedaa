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
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import java.util.UUID

class AlarmOverlayService : Service() {

    companion object {
        private const val NOTIFICATION_ID = 9001
        private const val CHANNEL_ID = "alarm_overlay_channel"
        private const val REQUIRED_TAPS = 5

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

    private var tapCount = 0
    private var tapButton: Button? = null
    private var tapCountText: TextView? = null

    override fun onCreate() {
        super.onCreate()
        isRunning = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        alarmId = intent?.getStringExtra("alarm_id") ?: ""
        alarmType = intent?.getStringExtra("alarm_type") ?: ""
        title = intent?.getStringExtra("title") ?: "Alarm"

        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())
        showOverlay()

        return START_STICKY
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

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("Alarm Active")
                .setContentText("Tap $REQUIRED_TAPS times to dismiss")
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("Alarm Active")
                .setContentText("Tap $REQUIRED_TAPS times to dismiss")
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

        val subtitleView = TextView(this).apply {
            text = "Tap the button $REQUIRED_TAPS times to dismiss"
            textSize = 18f
            setTextColor(Color.parseColor("#AAAAAA"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 48)
        }
        layout.addView(subtitleView)

        tapCountText = TextView(this).apply {
            text = "0 / $REQUIRED_TAPS"
            textSize = 72f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, 0, 0, 32)
        }
        layout.addView(tapCountText)

        tapButton = Button(this).apply {
            text = "TAP TO DISMISS"
            textSize = 24f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#4CAF50"))
            setPadding(64, 48, 64, 48)
            setOnClickListener { onTapButtonClicked() }
        }
        layout.addView(tapButton)

        val db = AlarmDatabase.getInstance(this)
        val currentSnoozeCount = db.getSnoozeCount(alarmId)
        val remainingSnoozes = AlarmDatabase.MAX_SNOOZES - currentSnoozeCount
        val canSnooze = remainingSnoozes > 0

        val snoozeButton = Button(this).apply {
            text = if (canSnooze) "SNOOZE ($remainingSnoozes left)" else "NO SNOOZES LEFT"
            textSize = 16f
            setTextColor(Color.WHITE)
            setBackgroundColor(if (canSnooze) Color.parseColor("#FF9800") else Color.parseColor("#666666"))
            setPadding(48, 24, 48, 24)
            isEnabled = canSnooze
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

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            PixelFormat.TRANSLUCENT
        )
        params.gravity = Gravity.CENTER

        try {
            windowManager?.addView(overlayView, params)
        } catch (_: Exception) {}
    }

    private fun onTapButtonClicked() {
        tapCount++
        tapCountText?.text = "$tapCount / $REQUIRED_TAPS"

        if (tapCount >= REQUIRED_TAPS) {
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

        // Get current snooze count
        val currentSnoozeCount = db.getSnoozeCount(alarmId)
        if (currentSnoozeCount >= AlarmDatabase.MAX_SNOOZES) {
            Toast.makeText(this, "Maximum snoozes reached", Toast.LENGTH_SHORT).show()
            return
        }

        val newSnoozeCount = currentSnoozeCount + 1
        val snoozeMs = AlarmDatabase.SNOOZE_MINUTES * 60 * 1000L
        val snoozeTime = System.currentTimeMillis() + snoozeMs
        val snoozeId = UUID.randomUUID().toString()

        // Build snooze title
        val baseTitle = title.replace(Regex("\\s*\\(Snoozed \\d+/\\d+\\)$"), "")
        val snoozeTitle = "$baseTitle (Snoozed $newSnoozeCount/${AlarmDatabase.MAX_SNOOZES})"

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
