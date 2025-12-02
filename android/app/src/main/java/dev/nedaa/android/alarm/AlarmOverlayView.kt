package dev.nedaa.android.alarm

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.util.Log
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import dev.nedaa.android.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.random.Random

class AlarmOverlayView(
    context: Context,
    private val alarmType: String,
    private val alarmSubtitle: String?,
    private val challengeType: String?,
    private val snoozeMinutes: Int,
    private val mathDifficulty: String,
    private val mathQuestionCount: Int,
    private val tapCount: Int,
    private val challengeGracePeriodSec: Int,
    private val onDismiss: () -> Unit,
    private val onSnooze: () -> Unit,
    private val onChallengeStarted: () -> Unit,
    private val onGracePeriodEnded: () -> Unit
) : LinearLayout(context) {

    companion object {
        private const val TAG = "AlarmOverlayView"
    }

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var timeText: TextView
    private lateinit var challengeContainer: LinearLayout
    private lateinit var buttonContainer: LinearLayout
    private lateinit var hintContainer: LinearLayout
    private lateinit var dismissButton: Button
    private lateinit var snoozeButton: Button

    private var showingChallenge = false
    private var mathAnswer: Int = 0
    private var mathQuestionsAnswered: Int = 0
    private var currentTapCount = 0
    private var gracePeriodRemaining: Int = 0
    private var gracePeriodActive = false
    private var gracePeriodRunnable: Runnable? = null
    private var gracePeriodText: TextView? = null

    // Emergency dismiss after 7 minutes (hidden feature)
    private val challengeStartTime = System.currentTimeMillis()
    private val emergencyDismissTimeMs = 7 * 60 * 1000L // 7 minutes

    init {
        Log.d(TAG, "AlarmOverlayView init: challengeType=$challengeType")
        orientation = VERTICAL
        setBackgroundColor(Color.BLACK)
        gravity = Gravity.CENTER
        setPadding(48, 48, 48, 48)

        isFocusable = true
        isFocusableInTouchMode = true

        createUI()
        startTimeUpdater()
    }

    private fun createUI() {
        // Time display
        timeText = TextView(context).apply {
            textSize = 72f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            typeface = Typeface.DEFAULT_BOLD
        }
        addView(timeText)
        updateTime()

        // Alarm title - use Android string resources
        val alarmTitleText = TextView(context).apply {
            textSize = 28f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, 48, 0, 8)
            text = if (alarmType == "fajr")
                context.getString(R.string.alarm_fajr_prayer)
            else
                context.getString(R.string.alarm_jummah_prayer)
        }
        addView(alarmTitleText)

        // Subtitle message (e.g., "Prayer is better than sleep" for Fajr)
        if (!alarmSubtitle.isNullOrEmpty()) {
            val subtitleText = TextView(context).apply {
                textSize = 18f
                setTextColor(0xFFFFD700.toInt()) // Gold color
                gravity = Gravity.CENTER
                setPadding(0, 24, 0, 0)
                text = alarmSubtitle
            }
            addView(subtitleText)
        }

        // Challenge container (hidden initially)
        challengeContainer = LinearLayout(context).apply {
            orientation = VERTICAL
            gravity = Gravity.CENTER
            visibility = View.GONE
            setPadding(0, 64, 0, 0)
        }
        addView(challengeContainer)

        // Button container
        buttonContainer = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, 64, 0, 0)
        }

        // Snooze button
        snoozeButton = Button(context).apply {
            text = context.getString(R.string.alarm_snooze_with_minutes, snoozeMinutes)
            textSize = 18f
            setTextColor(Color.WHITE)
            setBackgroundColor(0xFF333333.toInt())
            setPadding(48, 24, 48, 24)
            setOnClickListener { handleSnooze() }
        }

        val snoozeParams = LayoutParams(
            LayoutParams.WRAP_CONTENT,
            LayoutParams.WRAP_CONTENT
        ).apply { marginEnd = 16 }
        buttonContainer.addView(snoozeButton, snoozeParams)

        // Dismiss button
        dismissButton = Button(context).apply {
            text = context.getString(R.string.alarm_dismiss)
            textSize = 18f
            setTextColor(Color.WHITE)
            setBackgroundColor(0xFFE53935.toInt())
            setPadding(48, 24, 48, 24)
            setOnClickListener { handleDismiss() }
        }
        buttonContainer.addView(dismissButton)

        addView(buttonContainer)

        // Challenge hint container
        hintContainer = LinearLayout(context).apply {
            orientation = VERTICAL
            gravity = Gravity.CENTER
        }
        if (!challengeType.isNullOrEmpty() && challengeType != "none") {
            val hintText = TextView(context).apply {
                text = when (challengeType) {
                    "math" -> if (mathQuestionCount > 1)
                        context.getString(R.string.alarm_solve_math_problems, mathQuestionCount)
                    else
                        context.getString(R.string.alarm_solve_math_problem)
                    "tap" -> context.getString(R.string.alarm_tap_instruction, tapCount)
                    else -> ""
                }
                textSize = 14f
                setTextColor(0xFF666666.toInt())
                gravity = Gravity.CENTER
                setPadding(0, 32, 0, 0)
            }
            hintContainer.addView(hintText)
        }
        addView(hintContainer)
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

    private fun handleDismiss() {
        Log.d(TAG, "Dismiss pressed, challengeType=$challengeType, showingChallenge=$showingChallenge")

        // Check for emergency dismiss (hidden feature - 7 minutes elapsed)
        val elapsed = System.currentTimeMillis() - challengeStartTime
        if (elapsed >= emergencyDismissTimeMs) {
            Log.d(TAG, "Emergency dismiss activated after ${elapsed / 1000}s")
            gracePeriodActive = false
            onDismiss()
            return
        }

        if (!challengeType.isNullOrEmpty() && challengeType != "none" && !showingChallenge) {
            showChallenge()
            return
        }

        onDismiss()
    }

    private fun handleSnooze() {
        Log.d(TAG, "Snooze pressed")
        onSnooze()
    }

    private fun showChallenge() {
        Log.d(TAG, "Showing challenge: $challengeType")
        showingChallenge = true

        // Pause audio and start grace period
        onChallengeStarted()
        startGracePeriod()

        // Hide dismiss button but keep snooze available
        dismissButton.visibility = View.GONE
        hintContainer.visibility = View.GONE

        challengeContainer.removeAllViews()
        challengeContainer.visibility = View.VISIBLE

        // Add grace period countdown at top
        gracePeriodText = TextView(context).apply {
            textSize = 14f
            setTextColor(0xFF4CAF50.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 24)
            text = context.getString(R.string.alarm_sound_paused_for, challengeGracePeriodSec)
        }
        challengeContainer.addView(gracePeriodText)

        when (challengeType) {
            "math" -> showMathChallenge()
            "tap" -> showTapChallenge()
        }
    }

    private fun hideChallenge() {
        Log.d(TAG, "Hiding challenge, returning to buttons")
        showingChallenge = false
        mathQuestionsAnswered = 0
        currentTapCount = 0
        mathProgressForeground = null

        // Hide challenge container
        challengeContainer.visibility = View.GONE
        challengeContainer.removeAllViews()

        // Show dismiss button and hint again (snooze is already visible)
        dismissButton.visibility = View.VISIBLE
        hintContainer.visibility = View.VISIBLE
    }

    private fun startGracePeriod() {
        gracePeriodRemaining = challengeGracePeriodSec
        gracePeriodActive = true

        gracePeriodRunnable = object : Runnable {
            override fun run() {
                if (!gracePeriodActive) return

                gracePeriodRemaining--

                if (gracePeriodRemaining > 0) {
                    gracePeriodText?.text = context.getString(R.string.alarm_sound_resumes_in, gracePeriodRemaining)
                    gracePeriodText?.setTextColor(
                        if (gracePeriodRemaining <= 5) 0xFFFF5722.toInt() else 0xFF4CAF50.toInt()
                    )
                    handler.postDelayed(this, 1000)
                } else {
                    gracePeriodActive = false
                    gracePeriodText?.text = "⚠ ${context.getString(R.string.alarm_sound_resumed)}"
                    gracePeriodText?.setTextColor(0xFFE53935.toInt())
                    onGracePeriodEnded()
                    // Return to dismiss/snooze buttons
                    hideChallenge()
                }
            }
        }
        handler.post(gracePeriodRunnable!!)
    }

    private fun resetGracePeriod() {
        Log.d(TAG, "Resetting grace period")
        gracePeriodRemaining = challengeGracePeriodSec
        gracePeriodText?.text = context.getString(R.string.alarm_sound_resumes_in, gracePeriodRemaining)
        gracePeriodText?.setTextColor(0xFF4CAF50.toInt())
    }

    // Math challenge progress bar reference (to update across questions)
    private var mathProgressForeground: View? = null
    private var mathProgressBarWidth: Int = 280

    private fun showMathChallenge() {
        mathQuestionsAnswered = 0

        // Add progress bar if multiple questions
        if (mathQuestionCount > 1) {
            val progressBarHeight = 12
            val progressContainer = FrameLayout(context).apply {
                setPadding(0, 16, 0, 24)
            }
            val progressContainerParams = LayoutParams(
                (mathProgressBarWidth * resources.displayMetrics.density).toInt(),
                LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.CENTER
            }

            // Background bar (gray)
            val backgroundBar = View(context).apply {
                background = GradientDrawable().apply {
                    setColor(0xFF333333.toInt())
                    cornerRadius = (progressBarHeight / 2) * resources.displayMetrics.density
                }
            }
            val bgParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                (progressBarHeight * resources.displayMetrics.density).toInt()
            ).apply {
                gravity = Gravity.CENTER_VERTICAL
            }
            progressContainer.addView(backgroundBar, bgParams)

            // Foreground bar (green)
            mathProgressForeground = View(context).apply {
                background = GradientDrawable().apply {
                    setColor(0xFF4CAF50.toInt())
                    cornerRadius = (progressBarHeight / 2) * resources.displayMetrics.density
                }
            }
            val fgParams = FrameLayout.LayoutParams(
                0,
                (progressBarHeight * resources.displayMetrics.density).toInt()
            ).apply {
                gravity = Gravity.CENTER_VERTICAL or Gravity.START
            }
            progressContainer.addView(mathProgressForeground, fgParams)

            challengeContainer.addView(progressContainer, progressContainerParams)
        }

        generateMathProblem()
    }

    private fun updateMathProgressBar() {
        mathProgressForeground?.let { bar ->
            val progress = mathQuestionsAnswered.toFloat() / mathQuestionCount.toFloat()
            val newWidth = (mathProgressBarWidth * resources.displayMetrics.density * progress).toInt()
            val params = bar.layoutParams as FrameLayout.LayoutParams
            params.width = newWidth
            bar.layoutParams = params
        }
    }

    private fun generateMathProblem() {
        // Generate numbers based on difficulty
        val (minVal, maxVal, useMultiplication) = when (mathDifficulty) {
            "hard" -> Triple(10, 99, true)
            "medium" -> Triple(10, 50, false)
            else -> Triple(1, 20, false) // easy
        }

        val a = Random.nextInt(minVal, maxVal + 1)
        val b = Random.nextInt(minVal, maxVal + 1)

        val (question, answer) = if (useMultiplication && Random.nextBoolean()) {
            val smallA = Random.nextInt(2, 13)
            val smallB = Random.nextInt(2, 13)
            "$smallA × $smallB = ?" to (smallA * smallB)
        } else {
            "$a + $b = ?" to (a + b)
        }

        mathAnswer = answer

        val questionText = TextView(context).apply {
            text = question
            textSize = 36f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        }
        challengeContainer.addView(questionText)

        val answerInput = EditText(context).apply {
            hint = context.getString(R.string.alarm_answer)
            textSize = 24f
            setTextColor(Color.WHITE)
            setHintTextColor(0xFF888888.toInt())
            gravity = Gravity.CENTER
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_SIGNED
            setPadding(32, 16, 32, 16)
        }
        val inputParams = LayoutParams(
            LayoutParams.MATCH_PARENT,
            LayoutParams.WRAP_CONTENT
        ).apply {
            topMargin = 32
        }
        challengeContainer.addView(answerInput, inputParams)

        val submitButton = Button(context).apply {
            text = context.getString(R.string.alarm_submit)
            textSize = 18f
            setTextColor(Color.WHITE)
            setBackgroundColor(0xFF4CAF50.toInt())
            setPadding(48, 24, 48, 24)
            setOnClickListener {
                val userAnswer = answerInput.text.toString().toIntOrNull()
                if (userAnswer == mathAnswer) {
                    mathQuestionsAnswered++
                    // Reset grace period on each correct answer
                    resetGracePeriod()
                    // Update progress bar
                    updateMathProgressBar()

                    if (mathQuestionsAnswered >= mathQuestionCount) {
                        gracePeriodActive = false
                        onDismiss()
                    } else {
                        // Show next question - keep grace period text and progress bar
                        val childCount = challengeContainer.childCount
                        // Remove everything after progress bar (index 1) and grace period text (index 0)
                        val keepCount = if (mathQuestionCount > 1) 2 else 1
                        for (i in childCount - 1 downTo keepCount) {
                            challengeContainer.removeViewAt(i)
                        }
                        generateMathProblem()
                    }
                } else {
                    answerInput.setText("")
                    answerInput.error = context.getString(R.string.alarm_wrong_answer)
                }
            }
        }
        val buttonParams = LayoutParams(
            LayoutParams.WRAP_CONTENT,
            LayoutParams.WRAP_CONTENT
        ).apply {
            topMargin = 32
            gravity = Gravity.CENTER
        }
        challengeContainer.addView(submitButton, buttonParams)
    }

    private fun showTapChallenge() {
        currentTapCount = 0

        val instructionText = TextView(context).apply {
            text = context.getString(R.string.alarm_tap_instruction, tapCount)
            textSize = 20f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        }
        challengeContainer.addView(instructionText)

        // Progress bar container
        val progressBarHeight = 16
        val progressBarWidth = 280
        val progressContainer = FrameLayout(context).apply {
            setPadding(0, 32, 0, 32)
        }
        val progressContainerParams = LayoutParams(
            (progressBarWidth * resources.displayMetrics.density).toInt(),
            LayoutParams.WRAP_CONTENT
        ).apply {
            gravity = Gravity.CENTER
        }

        // Background bar (gray)
        val backgroundBar = View(context).apply {
            background = GradientDrawable().apply {
                setColor(0xFF333333.toInt())
                cornerRadius = (progressBarHeight / 2) * resources.displayMetrics.density
            }
        }
        val bgParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            (progressBarHeight * resources.displayMetrics.density).toInt()
        ).apply {
            gravity = Gravity.CENTER_VERTICAL
        }
        progressContainer.addView(backgroundBar, bgParams)

        // Foreground bar (green, animates width)
        val foregroundBar = View(context).apply {
            background = GradientDrawable().apply {
                setColor(0xFF4CAF50.toInt())
                cornerRadius = (progressBarHeight / 2) * resources.displayMetrics.density
            }
        }
        val fgParams = FrameLayout.LayoutParams(
            0, // Starts at 0 width
            (progressBarHeight * resources.displayMetrics.density).toInt()
        ).apply {
            gravity = Gravity.CENTER_VERTICAL or Gravity.START
        }
        progressContainer.addView(foregroundBar, fgParams)

        challengeContainer.addView(progressContainer, progressContainerParams)

        val tapButton = Button(context).apply {
            text = context.getString(R.string.alarm_tap)
            textSize = 24f
            setTextColor(Color.WHITE)
            setBackgroundColor(0xFF2196F3.toInt())
            setPadding(96, 48, 96, 48)
            setOnClickListener {
                currentTapCount++
                // Reset grace period on each successful tap
                resetGracePeriod()

                // Update progress bar
                val progress = currentTapCount.toFloat() / tapCount.toFloat()
                val newWidth = (progressBarWidth * resources.displayMetrics.density * progress).toInt()
                val newFgParams = fgParams.apply {
                    width = newWidth
                }
                foregroundBar.layoutParams = newFgParams

                if (currentTapCount >= tapCount) {
                    gracePeriodActive = false
                    onDismiss()
                }
            }
        }
        val buttonParams = LayoutParams(
            LayoutParams.WRAP_CONTENT,
            LayoutParams.WRAP_CONTENT
        ).apply {
            gravity = Gravity.CENTER
        }
        challengeContainer.addView(tapButton, buttonParams)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        // Block back button
        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            Log.d(TAG, "Back button blocked")
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    fun cleanup() {
        gracePeriodActive = false
        handler.removeCallbacksAndMessages(null)
    }
}
