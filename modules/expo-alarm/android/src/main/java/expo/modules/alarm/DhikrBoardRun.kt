package expo.modules.alarm

// One step's dhikr, by its index in the rows, and its cards in board order.
data class DhikrRound(val row: Int, val cards: List<String>)

// src/utils/dhikrTask.ts; dhikr-draw.tsv and dhikr-line.tsv pin the two.
object DhikrRules {

    // JS DHIKR_SPOKEN_PAUSE.
    private const val SPOKEN_PAUSE = " … "

    // A row's four cards, its answer first.
    fun cardsOf(row: DhikrTask.Row): List<String> = listOf(row.answer) + row.others

    // The dhikr with its word in the gap.
    fun full(row: DhikrTask.Row): String = row.before + row.answer + row.after

    // The dhikr as a screen reader says it, the gap named between pauses.
    fun spoken(row: DhikrTask.Row, gap: String): String =
        listOf(row.before.trim(), gap, row.after.trim()).filter { it.isNotEmpty() }.joinToString(SPOKEN_PAUSE)

    // A row the run has not shown, from a dhikr it has not shown, while one is
    // left; then any row it has shown, from a dhikr other than the last.
    fun draw(rows: List<DhikrTask.Row>, seen: List<Int>, rng: TaskRng.Rng): DhikrRound {
        val usedSources = seen.map { rows[it].sourceId }.toSet()
        val fresh = rows.indices.filter { rows[it].sourceId !in usedSources }
        val lastSource = seen.lastOrNull()?.let { rows[it].sourceId }
        val again = seen.distinct().filter { rows[it].sourceId != lastSource }
        val pool = fresh.ifEmpty { again.ifEmpty { rows.indices.toList() } }
        val row = pool[TaskRng.drawInt(rng, 0, pool.size - 1)]
        return DhikrRound(row, TaskRng.shuffled(cardsOf(rows[row]), rng))
    }
}

// The gap's box, centred on the text's ink and at least `minHeight` tall.
object DhikrGap {

    // Offsets from the baseline; `top` is negative.
    data class Box(val top: Float, val bottom: Float)

    // The filled gap's width, and the scale that fits its word between the insets.
    data class Fit(val width: Float, val scale: Float)

    // What stands in the line for an empty gap, so the line's text never holds the answer.
    const val EMPTY = "\uFFFC"

    fun textOf(row: DhikrTask.Row, filled: Boolean): String = if (filled) row.answer else EMPTY

    // Forbids a line break on either side of it.
    const val JOINER = "\u2060"

    data class Line(val before: String, val gap: String, val after: String)

    // The line's parts. A word with no space to the gap is joined to it,
    // as JS dhikrLineOf keeps it.
    fun lineOf(row: DhikrTask.Row, filled: Boolean): Line = Line(
        if (row.before.lastOrNull()?.isWhitespace() == false) row.before + JOINER else row.before,
        textOf(row, filled),
        if (row.after.firstOrNull()?.isWhitespace() == false) JOINER + row.after else row.after,
    )

    // `available` is the line's width, 0 when unknown; the gap never passes it.
    fun fitOf(word: Float, inline: Float, minWidth: Float, available: Float): Fit {
        val natural = maxOf(minWidth, word + 2 * inline)
        if (available <= 0f || natural <= available) return Fit(natural, 1f)
        return Fit(available, ((available - 2 * inline) / word).coerceIn(0f, 1f))
    }

    fun boxOf(ascent: Float, descent: Float, minHeight: Float): Box {
        val height = maxOf(minHeight, descent - ascent)
        val middle = (ascent + descent) / 2f
        return Box(middle - height / 2f, middle + height / 2f)
    }
}

// As JS DHIKR_PHASE.
enum class DhikrPhase { ASKING, HELD, SOLVED }

// What the reader hears of the line: its gap, again, or the full dhikr.
enum class DhikrLabel { SPOKEN, ANOTHER, FULL }

// `seen` holds every row this run has shown, the board's own included;
// `replaced` counts the dhikr replaced so far.
data class DhikrBoardState(
    val round: DhikrRound,
    val seen: List<Int>,
    val phase: DhikrPhase,
    val replaced: Int,
) {
    private val asking get() = phase == DhikrPhase.ASKING

    val gapFilled: Boolean get() = !asking

    // No card is ever marked; a card held still names its word.
    val cardState: AnswerCardState get() = if (asking) AnswerCardState.REST else AnswerCardState.HELD

    val noteShown: Boolean get() = phase == DhikrPhase.HELD

    val anotherShown: Boolean get() = asking && replaced > 0

    val label: DhikrLabel
        get() = when {
            !asking -> DhikrLabel.FULL
            replaced > 0 -> DhikrLabel.ANOTHER
            else -> DhikrLabel.SPOKEN
        }
}

sealed interface DhikrTap {
    val state: DhikrBoardState? get() = null

    data class Solved(override val state: DhikrBoardState) : DhikrTap
    data class Held(override val state: DhikrBoardState) : DhikrTap
    data object Ignored : DhikrTap
}

// As JS DhikrBoard: the answer solves; another card completes the dhikr for
// a moment, then a new dhikr takes its place.
object DhikrBoardRun {

    // JS DHIKR_HOLD_MS and SPOKEN_MS_PER_CHARACTER.
    const val HOLD_MS = 1500L
    const val READER_HOLD_MS = 5000L
    const val SPOKEN_MS_PER_CHARACTER = 80L

    fun start(rows: List<DhikrTask.Row>, drawn: List<Int>, rng: TaskRng.Rng): DhikrBoardState {
        val round = DhikrRules.draw(rows, drawn, rng)
        return DhikrBoardState(round, drawn + round.row, DhikrPhase.ASKING, replaced = 0)
    }

    fun choose(state: DhikrBoardState, position: Int, rows: List<DhikrTask.Row>): DhikrTap {
        if (state.phase != DhikrPhase.ASKING) return DhikrTap.Ignored
        return if (state.round.cards[position] == rows[state.round.row].answer) {
            DhikrTap.Solved(state.copy(phase = DhikrPhase.SOLVED))
        } else {
            DhikrTap.Held(state.copy(phase = DhikrPhase.HELD))
        }
    }

    // Ends a held dhikr's moment with another dhikr.
    fun replace(state: DhikrBoardState, rows: List<DhikrTask.Row>, rng: TaskRng.Rng): DhikrBoardState {
        if (state.phase != DhikrPhase.HELD) return state
        val round = DhikrRules.draw(rows, state.seen, rng)
        return DhikrBoardState(round, state.seen + round.row, DhikrPhase.ASKING, state.replaced + 1)
    }

    // Android reports no end of speech, so a reader's hold follows the length.
    fun holdMs(screenReader: Boolean, spokenLength: Long): Long =
        if (screenReader) maxOf(READER_HOLD_MS, spokenLength * SPOKEN_MS_PER_CHARACTER) else HOLD_MS
}
