package expo.modules.alarm

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.view.ActionMode
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.view.ViewTreeObserver
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.LinearLayout

// One dhikr to type, as JS DhikrChallenge; DhikrTypedRun rules each try.
// The shell window takes the keyboard while this board shows.
class DhikrTypedBoard(context: Context, input: BoardInput, private val host: BoardHost) : TaskBoard {

    private val pool = DhikrTypedRun.poolOf(input.task)

    private val rng = input.rng

    // The phrase's index in the pool; never the one this task's last step showed.
    private var phrase = DhikrTypedRun.pick(pool.size, input.drawn.lastOrNull(), rng)

    private var strikes = 0

    private val handler = Handler(Looper.getMainLooper())

    private val endWrong = Runnable { showWrong(false) }

    private val hint = overlayText(context, HINT_SP, COLOR_TEXT_MUTED).apply {
        text = context.getString(R.string.overlay_task_dhikr_type_hint)
    }

    // Written right to left in any app language, as JS writingDirection.
    private val arabic = overlayText(context, ARABIC_SP, COLOR_TEXT).apply {
        typeface = Typeface.DEFAULT_BOLD
        textDirection = View.TEXT_DIRECTION_RTL
    }

    private val transliteration = overlayText(context, TRANSLITERATION_SP, COLOR_TEXT_SECONDARY).apply {
        textDirection = View.TEXT_DIRECTION_LTR
    }

    // Read as one line that names the phrase, as JS dhikrPhrase.
    private val panel = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = matchWidth().apply { topMargin = context.dp(GAP_DP) }
        background = GradientDrawable().apply {
            setColor(Color.parseColor(COLOR_SURFACE))
            cornerRadius = context.dpf(PANEL_RADIUS_DP)
        }
        val inset = context.dp(PANEL_INSET_DP)
        setPadding(inset, inset, inset, inset)
        isFocusable = true
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        addView(arabic)
        addView(transliteration, matchWidth().apply { topMargin = context.dp(LINE_GAP_DP) })
    }

    // Above the field, so the keyboard never covers it; kept while empty.
    private val wrong = overlayText(context, WRONG_SP, COLOR_ERROR).apply {
        minHeight = context.dp(WRONG_MIN_DP)
        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    private val field = EditText(context).apply {
        hint = context.getString(R.string.overlay_task_dhikr_type_field)
        textSize = FIELD_SP
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(Color.parseColor(COLOR_TEXT))
        setHintTextColor(Color.parseColor(COLOR_HINT))
        gravity = android.view.Gravity.CENTER
        minHeight = context.dp(MIN_TARGET_DP)
        minimumHeight = context.dp(MIN_TARGET_DP)
        val inset = context.dp(FIELD_INSET_DP)
        setPadding(inset, inset, inset, inset)
        inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
        imeOptions = EditorInfo.IME_ACTION_DONE or EditorInfo.IME_FLAG_NO_EXTRACT_UI
        // As JS contextMenuHidden: no select, copy or paste.
        isLongClickable = false
        setTextIsSelectable(false)
        customSelectionActionModeCallback = NO_MENU
        customInsertionActionModeCallback = NO_MENU
        setOnEditorActionListener { _, action, _ ->
            if (action != EditorInfo.IME_ACTION_DONE) return@setOnEditorActionListener false
            submit()
            true
        }
        addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
            override fun afterTextChanged(s: Editable?) = showSubmit()
        })
    }

    private val submitButton = overlayButton(
        context, context.getString(R.string.overlay_task_dhikr_type_submit), COLOR_PRIMARY, COLOR_TEXT_ON_ACCENT,
    ).apply {
        layoutParams = matchWidth().apply { topMargin = context.dp(GAP_DP) }
        setOnClickListener { submit() }
    }

    // As JS autoFocus: the keyboard rises once the window can take it.
    private val raiseKeyboard = object : ViewTreeObserver.OnWindowFocusChangeListener {
        override fun onWindowFocusChanged(hasFocus: Boolean) {
            if (!hasFocus || !field.hasFocus()) return
            field.context.getSystemService(InputMethodManager::class.java)
                ?.showSoftInput(field, InputMethodManager.SHOW_IMPLICIT)
        }
    }

    override val view: View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = matchWidth()
        addView(hint)
        addView(panel)
        addView(wrong, matchWidth().apply { topMargin = context.dp(GAP_DP) })
        addView(field, matchWidth().apply { topMargin = context.dp(LINE_GAP_DP) })
        addView(submitButton)
    }

    init {
        host.onDraw(phrase)
        showPhrase()
        showWrong(false)
        showSubmit()
        field.viewTreeObserver.addOnWindowFocusChangeListener(raiseKeyboard)
        field.requestFocus()
    }

    override fun release() {
        handler.removeCallbacks(endWrong)
        if (field.viewTreeObserver.isAlive) field.viewTreeObserver.removeOnWindowFocusChangeListener(raiseKeyboard)
    }

    private fun submit() {
        val shown = pool[phrase]
        val submitted = DhikrTypedRun.submit(field.text.toString(), shown, strikes)
        strikes = submitted.strikes
        when (submitted.outcome) {
            DhikrTypedRun.Outcome.SOLVED -> {
                field.performHapticFeedback(OverlayHaptic.CONFIRM)
                host.onSolved()
            }
            DhikrTypedRun.Outcome.WRONG -> {
                missed()
                field.announceForAccessibility(view.context.getString(R.string.overlay_task_dhikr_type_wrong))
            }
            DhikrTypedRun.Outcome.NEXT -> {
                missed()
                phrase = DhikrTypedRun.pick(pool.size, phrase, rng)
                host.onDraw(phrase)
                field.setText("")
                showPhrase()
                field.announceForAccessibility(phraseLine(R.string.overlay_task_dhikr_type_new))
            }
        }
    }

    // A miss keeps the typed text, so a typo is fixed in place.
    private fun missed() {
        field.performHapticFeedback(OverlayHaptic.REJECT)
        showWrong(true)
        handler.removeCallbacks(endWrong)
        handler.postDelayed(endWrong, WRONG_MS)
    }

    private fun showPhrase() {
        val shown = pool[phrase]
        arabic.text = shown.arabic
        transliteration.text = shown.transliteration
        panel.contentDescription = phraseLine(R.string.overlay_task_dhikr_type_phrase)
    }

    private fun showWrong(shown: Boolean) {
        val context = view.context
        wrong.text = if (shown) context.getString(R.string.overlay_task_dhikr_type_wrong) else ""
        field.background = GradientDrawable().apply {
            setColor(Color.parseColor(COLOR_INPUT_BG))
            cornerRadius = context.dpf(FIELD_RADIUS_DP)
            if (shown) setStroke(context.dp(WRONG_EDGE_DP), Color.parseColor(COLOR_ERROR))
        }
    }

    // As JS: Submit waits for typing; Done on the keyboard always submits.
    private fun showSubmit() {
        val typed = !field.text.isNullOrEmpty()
        submitButton.isEnabled = typed
        submitButton.alpha = if (typed) 1f else DISABLED_ALPHA
    }

    // Each language names the phrase in its own script.
    private fun phraseLine(id: Int): String {
        val shown = pool[phrase]
        return view.context.getString(id, shown.arabic, shown.transliteration)
    }

    private companion object {
        // JS DhikrChallenge: sm hint, 4xl phrase, lg transliteration, 22 field.
        const val HINT_SP = 14f
        const val ARABIC_SP = 36f
        const val TRANSLITERATION_SP = 18f
        const val FIELD_SP = 22f
        const val WRONG_SP = 14f
        const val WRONG_MIN_DP = 20
        const val PANEL_RADIUS_DP = 24f
        const val PANEL_INSET_DP = 24
        const val FIELD_RADIUS_DP = 12f
        const val FIELD_INSET_DP = 16
        const val WRONG_EDGE_DP = 2
        const val GAP_DP = 16
        const val LINE_GAP_DP = 8

        // How long a miss shows, as JS.
        const val WRONG_MS = 500L

        const val DISABLED_ALPHA = 0.5f

        val NO_MENU = object : ActionMode.Callback {
            override fun onCreateActionMode(mode: ActionMode?, menu: Menu?) = false
            override fun onPrepareActionMode(mode: ActionMode?, menu: Menu?) = false
            override fun onActionItemClicked(mode: ActionMode?, item: MenuItem?) = false
            override fun onDestroyActionMode(mode: ActionMode?) = Unit
        }
    }
}
