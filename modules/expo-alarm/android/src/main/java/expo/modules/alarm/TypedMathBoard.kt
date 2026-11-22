package expo.modules.alarm

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.view.ActionMode
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.LinearLayout

// Math's board with a typed answer: one question per step, drawn as
// MathCards draws it. A wrong answer replaces the question.
class TypedMathBoard(context: Context, input: BoardInput, private val host: BoardHost) : TaskBoard {

    private val difficulty =
        ChallengeDifficulty.fromId(TaskRun.difficultyOf(input.task)) ?: ChallengeDifficulty.EASY

    private val rng = input.rng

    private var round = MathCards.round(difficulty, rng)

    private var solved = false

    private val note = overlayText(context, 13f, COLOR_WARNING).apply {
        visibility = View.GONE
        accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        setPadding(0, 0, 0, context.dp(12))
    }

    // A sum reads left to right in either layout direction.
    private val question = overlayText(context, 36f, COLOR_TEXT).apply {
        typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
        textDirection = View.TEXT_DIRECTION_LTR
        background = GradientDrawable().apply {
            setColor(Color.parseColor(COLOR_INPUT_BG))
            cornerRadius = context.dp(16).toFloat()
        }
        setPadding(context.dp(24), context.dp(20), context.dp(24), context.dp(20))
        layoutParams = matchWidth().apply { bottomMargin = context.dp(20) }
    }

    private val answer = EditText(context).apply {
        hint = context.getString(R.string.overlay_math_hint)
        textSize = 28f
        setTextColor(Color.parseColor(COLOR_TEXT))
        setHintTextColor(Color.parseColor(COLOR_HINT))
        background = GradientDrawable().apply {
            setColor(Color.parseColor(COLOR_INPUT_BG))
            cornerRadius = context.dp(12).toFloat()
        }
        textAlignment = View.TEXT_ALIGNMENT_CENTER
        minHeight = context.dp(MIN_TARGET_DP)
        inputType = InputType.TYPE_CLASS_NUMBER
        imeOptions = EditorInfo.IME_ACTION_DONE
        // No paste: the answer is typed.
        isLongClickable = false
        customInsertionActionModeCallback = NoActions
        setPadding(context.dp(24), context.dp(16), context.dp(24), context.dp(16))
        layoutParams = matchWidth().apply { bottomMargin = context.dp(16) }
        setOnEditorActionListener { _, actionId, _ ->
            (actionId == EditorInfo.IME_ACTION_DONE).also { if (it) submit() }
        }
        addTextChangedListener(ClearsNote())
    }

    override val input: View get() = answer

    override val view: View = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        layoutParams = matchWidth()
        addView(note)
        addView(question)
        addView(answer)
        val submit = context.getString(R.string.overlay_math_submit)
        addView(overlayButton(context, submit, COLOR_PRIMARY, COLOR_TEXT_ON_ACCENT).apply {
            setOnClickListener { submit() }
        })
    }

    init {
        showQuestion()
    }

    private fun submit() {
        if (solved) return
        note.visibility = View.GONE
        val typed = answer.text.toString().trim().toIntOrNull() ?: return
        if (typed == round.answer) {
            solved = true
            host.onSolved()
            return
        }
        answer.performHapticFeedback(OverlayHaptic.REJECT)
        round = MathCards.round(difficulty, rng, round.question)
        showQuestion()
        note.text = view.context.getString(R.string.overlay_task_math_wrong)
        note.visibility = View.VISIBLE
    }

    private fun showQuestion() {
        val sign = when (round.question.operation) {
            MathOperation.ADD -> PLUS
            MathOperation.MULTIPLY -> TIMES
        }
        question.text = "${round.question.left} $sign ${round.question.right} = ?"
        answer.setText("")
    }

    // Typing after a wrong answer clears its note; showQuestion empties the field before the note shows.
    private inner class ClearsNote : TextWatcher {
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        override fun afterTextChanged(s: Editable?) {
            note.visibility = View.GONE
        }
    }

    private object NoActions : ActionMode.Callback {
        override fun onCreateActionMode(mode: ActionMode?, menu: Menu?) = false
        override fun onPrepareActionMode(mode: ActionMode?, menu: Menu?) = false
        override fun onActionItemClicked(mode: ActionMode?, item: MenuItem?) = false
        override fun onDestroyActionMode(mode: ActionMode?) {}
    }

    private companion object {
        const val PLUS = "+"
        const val TIMES = "×"
    }
}
