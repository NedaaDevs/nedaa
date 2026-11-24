package expo.modules.alarm

import android.annotation.SuppressLint
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.accessibility.AccessibilityManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import java.util.Locale
import kotlin.random.Random

// The task shell for a stack: start gate, Back, position line, board,
// handover, quiet bar and way out. It draws what TaskShellRun decides.
class TaskShellView(
    private val context: Context,
    private val tasks: List<WakeTasks.Task>,
    private val listener: Listener,
) {

    interface Listener {
        // The first board shows.
        fun onStart()

        // Back left the run; the start gate shows again.
        fun onBack()

        fun onSilence()
        fun onSound()

        // The last task is solved.
        fun onSolved()

        // "Stop alarm" was pressed.
        fun onStop()

        // "Stop alarm" appeared, which takes the emergency quiet away.
        fun onWayOut() = Unit
    }

    private val handler = Handler(Looper.getMainLooper())

    private val accessibility = context.getSystemService(AccessibilityManager::class.java)

    // Animations off: the quiet bar moves in steps, as under JS Reduce Motion.
    private val stepped = animationsOff(context)

    private val rng = TaskRng.Rng { Random.nextDouble() }

    private var run: TaskShellRun? = null

    // What the last Back kept; the next start resumes it.
    private var saved: TaskShellRun.Saved? = null

    private var board: TaskBoard? = null

    // As JS BackLink: a chevron to the start edge and the screen it returns to.
    private val backButton = TextView(context).apply {
        val name = context.getString(R.string.overlay_task_back)
        text = "$BACK_CHEVRON $name"
        contentDescription = context.getString(R.string.overlay_back_to, name)
        textSize = 15f
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(Color.parseColor(COLOR_PRIMARY))
        gravity = Gravity.CENTER_VERTICAL or Gravity.START
        minWidth = context.dp(MIN_TARGET_DP)
        minHeight = context.dp(MIN_TARGET_DP)
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { gravity = Gravity.START }
        speaksAsButton()
        setOnClickListener { back() }
    }

    private val positionLine = heading(17f, COLOR_TEXT_SECONDARY)

    private val stepLine = overlayText(context, 13f, COLOR_TEXT_MUTED)

    private val boardHeading = heading(20f, COLOR_TEXT).apply {
        setPadding(0, context.dp(12), 0, context.dp(16))
    }

    // A done board stays in sight, takes no touch and is hidden from the reader.
    private var boardDone = false

    private val boardHost = object : FrameLayout(context) {
        override fun onInterceptTouchEvent(event: MotionEvent): Boolean =
            boardDone || super.onInterceptTouchEvent(event)

        @SuppressLint("ClickableViewAccessibility")
        override fun onTouchEvent(event: MotionEvent): Boolean = boardDone || super.onTouchEvent(event)
    }.apply { layoutParams = matchWidth() }

    private val handoverPosition = overlayText(context, 17f, COLOR_TEXT_SECONDARY)

    private val handoverNext = heading(22f, COLOR_TEXT).apply {
        setPadding(0, context.dp(12), 0, 0)
    }

    private val handoverPanel = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = matchWidth()
        visibility = View.GONE
        setPadding(0, context.dp(32), 0, context.dp(32))
        addView(handoverPosition)
        addView(handoverNext)
    }

    private val quietBar = ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal).apply {
        max = BAR_MAX
        progressBackgroundTintList = ColorStateList.valueOf(Color.parseColor(COLOR_TRACK))
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        layoutParams = LinearLayout.LayoutParams(0, context.dp(4), 1f)
    }

    private val quietSeconds = overlayText(context, 12f, COLOR_TEXT_MUTED).apply {
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply { marginStart = context.dp(8) }
    }

    private val quietState = overlayText(context, 13f, COLOR_TEXT_MUTED)

    private val quietHelp = overlayText(context, 12f, COLOR_TEXT_MUTED).apply {
        text = context.getString(R.string.overlay_quiet_on_help)
    }

    private val quietRow = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = android.view.Gravity.CENTER_VERTICAL
        layoutParams = matchWidth().apply { topMargin = context.dp(16) }
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        addView(quietBar)
        addView(quietSeconds)
    }

    private val wayOutNote = overlayText(context, 13f, COLOR_TEXT_MUTED).apply {
        text = context.getString(R.string.overlay_task_way_out)
        setPadding(0, context.dp(16), 0, context.dp(8))
    }

    private val quietSpoken = spokenStatus(context)

    private val progressSpoken = spokenStatus(context)

    private val wayOutSpoken = spokenStatus(context)

    private val stopButton =
        overlayButton(context, context.getString(R.string.overlay_task_stop), COLOR_SNOOZE, COLOR_TEXT).apply {
            setOnClickListener { stop() }
        }

    private val wayOut = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = matchWidth()
        visibility = View.GONE
        addView(wayOutNote)
        addView(stopButton)
    }

    // Where the emergency quiet's banner and offer stand during a run.
    val bannerSlot = quietSlot(context)

    val offerSlot = quietSlot(context)

    // As JS alarm.audible; the strip also yields to the quiet's confirm.
    private var heard = true

    private var confirmOpen = false

    private var wayOutWas = false

    // "Stop alarm" shows in the open run, or showed in the run Back kept.
    val wayOutShown: Boolean get() = run?.wayOut ?: (saved?.clock?.wayOutShown ?: false)

    private val taskPanel = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = matchWidth()
        visibility = View.GONE
        listOf(
            backButton, positionLine, stepLine, bannerSlot, boardHeading, boardHost,
            handoverPanel, quietRow, quietState, quietHelp, wayOut, offerSlot,
        ).forEach(::addView)
        listOf(quietSpoken, progressSpoken, wayOutSpoken).forEach(::addView)
    }

    private lateinit var startButton: View

    private val gate = startGate()

    val view: View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = matchWidth()
        addView(gate)
        addView(taskPanel)
    }

    private val ticker = object : Runnable {
        override fun run() {
            val run = run ?: return
            val now = now()
            apply(run.tick(now))
            render(run, now)
            handler.postDelayed(this, TaskClock.TICK_MS)
        }
    }

    // Frees the timers; the board's view stays until the next board or the window goes.
    fun release() {
        handler.removeCallbacksAndMessages(null)
        board?.release()
        board = null
    }

    fun focusStart() = focusForReader(startButton)

    // A quiet holds the sound, or its confirm takes the strip's place.
    fun setQuiet(heard: Boolean, confirmOpen: Boolean) {
        this.heard = heard
        this.confirmOpen = confirmOpen
        val run = run ?: return
        val now = now()
        run.hear(heard, now)
        render(run, now)
    }

    // The solved panel takes the quiet strip's place, as JS TaskShell's done state.
    fun showSolved(panel: View) {
        taskPanel.addView(panel, taskPanel.indexOfChild(quietRow))
    }

    // As JS describeStart: the title, and the tasks under it for one or two.
    private fun startGate(): View {
        val start = TaskRun.start(tasks)
        val title = if (start is TaskRun.Start.Count) {
            context.resources.getQuantityString(R.plurals.overlay_task_start_count, start.size, start.size)
        } else {
            context.getString(R.string.overlay_task_start)
        }
        val detail = when (start) {
            is TaskRun.Start.Count -> null
            is TaskRun.Start.Pair ->
                context.getString(R.string.overlay_task_pair, nameOf(start.first), nameOf(start.second))
            is TaskRun.Start.One -> start.steps?.let {
                context.resources.getQuantityString(R.plurals.overlay_task_with_steps, it, nameOf(start.task), it)
            } ?: nameOf(start.task)
        }
        return LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = matchWidth()
            if (detail != null) {
                addView(overlayText(context, 15f, COLOR_TEXT_MUTED).apply {
                    text = detail
                    setPadding(0, context.dp(8), 0, context.dp(24))
                })
            }
            startButton = overlayButton(context, title, COLOR_PRIMARY, COLOR_TEXT_ON_ACCENT).apply {
                setOnClickListener { start() }
            }
            addView(startButton)
        }
    }

    private fun start() {
        if (run != null) return
        val now = now()
        val run = TaskShellRun(tasks, quietMs(), now, saved).also { this.run = it }
        run.hear(heard, now)
        listener.onStart()
        gate.visibility = View.GONE
        backButton.visibility = View.VISIBLE
        taskPanel.visibility = View.VISIBLE
        apply(run.open())
        showBoard(run)
        render(run, now)
        handler.postDelayed(ticker, TaskClock.TICK_MS)
    }

    // As JS handleBack: the run is kept and its quiet time ends.
    private fun back() {
        val left = run?.leave(now()) ?: return
        release()
        run = null
        saved = left.saved
        // A status the next run repeats is spoken again.
        listOf(quietSpoken, progressSpoken, wayOutSpoken).forEach { it.say(null) }
        handoverPanel.visibility = View.GONE
        taskPanel.visibility = View.GONE
        gate.visibility = View.VISIBLE
        apply(left.signal)
        listener.onBack()
        // As the JS ring screen: focus returns to the start button.
        focusStart()
    }

    private fun stop() {
        release()
        listener.onStop()
    }

    private fun showBoard(run: TaskShellRun) {
        clearBoard()
        val kind = NativeBoards.kindOf(run.task)
        boardHeading.text = context.getString(TaskBoards.headingOf(kind))
        val input = BoardInput(run.task, run.drawn, rng, openingOf(run, kind))
        val shown = TaskBoards.factoryOf(kind).create(context, input, object : BoardHost {
            override fun onSolved() = solved()
            override fun onDraw(item: Int) = run.draw(item)
        })
        board = shown
        boardHost.addView(shown.view)
        boardHeading.visibility = View.VISIBLE
        boardHost.visibility = View.VISIBLE
    }

    private fun clearBoard() {
        board?.release()
        board = null
        boardHost.removeAllViews()
    }

    private fun solved() {
        val run = run ?: return
        val now = now()
        val result = run.solved(now, quietMs()) ?: return
        when (val advance = result.advance) {
            TaskRun.Advance.Done -> {
                // As JS: a done run shows no Back, no quiet strip and no way out.
                backButton.visibility = View.GONE
                release()
                boardDone = true
                boardHost.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
                listOf(quietRow, quietState, quietHelp, wayOut, bannerSlot, offerSlot).forEach {
                    it.visibility = View.GONE
                }
                listOf(quietSpoken, progressSpoken, wayOutSpoken).forEach { it.say(null) }
                listener.onSolved()
                return
            }
            is TaskRun.Advance.Step -> showBoard(run)
            is TaskRun.Advance.Handover -> showHandover(run, advance.position)
        }
        apply(result.signal)
        render(run, now)
    }

    private fun showHandover(run: TaskShellRun, next: TaskRun.Position) {
        clearBoard()
        boardHeading.visibility = View.GONE
        boardHost.visibility = View.GONE
        handoverPosition.text = taskOf(run, next)
        handoverNext.text = nextOf(run, next)
        handoverPanel.visibility = View.VISIBLE
        handler.postDelayed({
            val now = now()
            apply(run.finishHandover(now, quietMs()))
            handoverPanel.visibility = View.GONE
            showBoard(run)
            render(run, now)
        }, TaskShellRun.HANDOVER_MS)
    }

    private fun apply(signal: TaskQuiet.Signal?) {
        when (signal) {
            TaskQuiet.Signal.START -> listener.onSilence()
            // Android has no warning haptic; reject is the nearest.
            TaskQuiet.Signal.ENDING -> view.performHapticFeedback(OverlayHaptic.REJECT)
            TaskQuiet.Signal.END -> listener.onSound()
            null -> Unit
        }
    }

    // During a handover the panel shows the position, as JS TaskShell does.
    private fun render(run: TaskShellRun, now: Long) {
        val handover = run.handover
        val shown = if (handover == null) View.VISIBLE else View.GONE
        positionLine.visibility = if (run.showsTaskLine) shown else View.GONE
        positionLine.text = taskOf(run, run.position)
        val steps = TaskRun.stepsOf(run.task)
        stepLine.visibility = if (steps > 1) shown else View.GONE
        stepLine.text = context.getString(R.string.overlay_task_step_of, run.position.step + 1, steps)
        progressSpoken.say(
            when (val spoken = TaskShellRun.spokenProgress(handover, run.position, run.done, saysOpening(run))) {
                is TaskShellRun.Spoken.Handover -> context.getString(
                    R.string.overlay_task_handover, taskOf(run, spoken.next), nextOf(run, spoken.next),
                )
                is TaskShellRun.Spoken.Step ->
                    context.getString(R.string.overlay_task_step_of, spoken.position.step + 1, steps)
                TaskShellRun.Spoken.Silent -> null
            },
        )
        renderQuiet(run.reading.clock, now, run.audible, strip = run.audible && !confirmOpen)
        wayOut.visibility = if (run.wayOut) View.VISIBLE else View.GONE
        wayOutSpoken.say(if (run.wayOut) context.getString(R.string.overlay_task_way_out) else null)
        if (run.wayOut && !wayOutWas) listener.onWayOut()
        wayOutWas = run.wayOut
    }

    private fun renderQuiet(clock: TaskClock, now: Long, audible: Boolean, strip: Boolean) {
        val phase = clock.quietPhase(now)
        val sounding = phase == TaskClock.QuietPhase.SOUNDING
        val state = context.getString(
            when (phase) {
                TaskClock.QuietPhase.PAUSED -> R.string.overlay_quiet_paused
                TaskClock.QuietPhase.ENDING -> R.string.overlay_quiet_soon
                TaskClock.QuietPhase.SOUNDING -> R.string.overlay_quiet_on
            },
        )
        quietState.text = state
        // As JS quietStatus: a pause is not spoken, so the reader is not talked over.
        quietSpoken.say(
            when {
                !audible -> null
                phase == TaskClock.QuietPhase.ENDING -> context.resources.getQuantityString(
                    R.plurals.overlay_quiet_ending, ENDING_SECONDS, ENDING_SECONDS,
                )
                sounding -> context.getString(R.string.overlay_quiet_on)
                else -> null
            },
        )
        val fill = if (phase == TaskClock.QuietPhase.ENDING) COLOR_WARNING else COLOR_PRIMARY
        quietBar.progressTintList = ColorStateList.valueOf(Color.parseColor(fill))
        quietBar.progress = (clock.quietFraction(now, stepped) * BAR_MAX).toInt()
        quietRow.visibility = if (strip && !sounding) View.VISIBLE else View.GONE
        quietState.visibility = if (strip) View.VISIBLE else View.GONE
        quietHelp.visibility = if (strip && sounding) View.VISIBLE else View.GONE
        val seconds = clock.quietSecondsLeft(now)
        quietSeconds.text = String.format(Locale.getDefault(), CLOCK_FORMAT, seconds / 60, seconds % 60)
        quietRow.contentDescription =
            context.resources.getQuantityString(R.plurals.overlay_quiet_left, seconds.toInt(), state, seconds.toInt())
    }

    private fun saysOpening(run: TaskShellRun): Boolean = NativeBoards.saysOpening(NativeBoards.kindOf(run.task))

    // As JS TaskShell's opening: the step line from a task's second step.
    private fun openingOf(run: TaskShellRun, kind: NativeBoards.Kind): String? {
        val opening = TaskShellRun.openingAt(run.position, run.done, NativeBoards.saysOpening(kind)) ?: return null
        return context.getString(R.string.overlay_task_step_of, opening.step + 1, TaskRun.stepsOf(run.task))
    }

    private fun heading(sizeSp: Float, color: String): TextView = overlayText(context, sizeSp, color).apply {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) isAccessibilityHeading = true
    }

    private fun nameOf(task: WakeTasks.Task): String =
        context.getString(TaskBoards.nameOf(NativeBoards.shownBoard(task)))

    private fun taskOf(run: TaskShellRun, position: TaskRun.Position): String =
        context.getString(R.string.overlay_task_of, position.task + 1, run.size)

    private fun nextOf(run: TaskShellRun, position: TaskRun.Position): String =
        context.getString(R.string.overlay_task_next, nameOf(run.taskAt(position)))

    // Read at each restart, so a screen reader turned on mid-alarm gets its longer quiet from the next solve.
    private fun quietMs(): Long =
        TaskClock.quietSecondsFor(accessibility?.isTouchExplorationEnabled == true) * TaskClock.SECOND_MS

    // Monotonic, so a wall-clock change cannot skip or stretch quiet time.
    private fun now(): Long = SystemClock.elapsedRealtime()

    private companion object {
        const val BAR_MAX = 10000

        const val CLOCK_FORMAT = "%d:%02d"

        // Bidi-mirrored, so it points to the start edge in RTL text.
        const val BACK_CHEVRON = "\u2039"

        const val ENDING_SECONDS = TaskClock.QUIET_ENDING_SECONDS.toInt()
    }
}
