package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// dhikr-rows, dhikr-draw and dhikr-line: the JS rows and dhikrTask rules, read by the JS tests too.
class DhikrBoardRunTest {

    private val rows = DhikrTask.ROWS

    @Test
    fun theRowsAreTheAppsRows() {
        val shared = sharedTable("dhikr-rows.tsv").map { cells ->
            val (index, source, before, after, answer) = cells
            listOf(index, source, before, after, answer, cells.drop(OTHERS_AT).joinToString(CELL_JOIN))
        }
        val native = rows.mapIndexed { index, row ->
            listOf(index.toString(), row.sourceId.toString(), row.before, row.after, row.answer, row.others.joinToString(CELL_JOIN))
        }
        assertEquals(shared, native)
    }

    @Test
    fun eachDrawMatchesTheJs() {
        var rng: TaskRng.Rng? = null
        var seen = emptyList<Int>()
        for (cells in sharedTable("dhikr-draw.tsv")) {
            val (case, op, arg, drawn, row) = cells
            val cards = cells[CARDS_AT]
            if (op == FixtureOp.START) {
                rng = TaskRng.seeded(arg.toLong())
                seen = if (drawn == FIXTURE_NONE) emptyList() else drawn.ints()
            } else {
                assertEquals(case, FixtureOp.DRAW, op)
            }
            val round = DhikrRules.draw(rows, seen, checkNotNull(rng))
            val expected = rows[row.toInt()]
            val dealt = listOf(expected.answer) + expected.others
            assertEquals(case, row.toInt(), round.row)
            assertEquals(case, cards.ints().map { dealt[it] }, round.cards)
            seen = seen + round.row
        }
    }

    @Test
    fun eachLineIsSaidAsTheJsSaysIt() {
        for ((index, full, spoken) in sharedTable("dhikr-line.tsv")) {
            val row = rows[index.toInt()]
            assertEquals(index, full, DhikrRules.full(row))
            assertEquals(index, spoken, DhikrRules.spoken(row, FIXTURE_GAP))
        }
    }

    @Test
    fun aListOfOneDhikrDrawsItAgain() {
        val one = listOf(rows[3], rows[4])
        val round = DhikrRules.draw(one, listOf(0, 1), TaskRng.seeded(SEED))
        assertTrue(round.row in one.indices)
    }

    @Test
    fun theStartReportsItsDhikrAndSkipsEarlierSteps() {
        val drawn = rows.indices.filter { it != 5 }
        val state = DhikrBoardRun.start(rows, drawn, TaskRng.seeded(SEED))
        assertEquals(5, state.round.row)
        assertEquals(drawn + 5, state.seen)
        assertEquals(DhikrPhase.ASKING, state.phase)
        assertEquals(0, state.replaced)
    }

    @Test
    fun theAnswerSolvesAndTheBoardTakesNoMoreTaps() {
        val start = DhikrBoardRun.start(rows, emptyList(), TaskRng.seeded(SEED))
        val tap = DhikrBoardRun.choose(start, answerAt(start), rows)
        assertTrue(tap is DhikrTap.Solved)
        val solved = checkNotNull(tap.state)
        assertEquals(DhikrPhase.SOLVED, solved.phase)
        assertTrue(solved.gapFilled)
        assertEquals(AnswerCardState.HELD, solved.cardState)
        for (position in ANSWER_CARD_PLACE.indices) assertEquals(DhikrTap.Ignored, DhikrBoardRun.choose(solved, position, rows))
    }

    @Test
    fun anotherCardCompletesTheDhikrAndNoCardIsMarkedWrong() {
        val start = DhikrBoardRun.start(rows, emptyList(), TaskRng.seeded(SEED))
        val other = ANSWER_CARD_PLACE.indices.first { it != answerAt(start) }
        val tap = DhikrBoardRun.choose(start, other, rows)
        assertTrue(tap is DhikrTap.Held)
        val held = checkNotNull(tap.state)
        assertEquals(DhikrPhase.HELD, held.phase)
        assertTrue(held.gapFilled)
        assertTrue(held.noteShown)
        assertEquals(DhikrLabel.FULL, held.label)
        assertEquals(AnswerCardState.HELD, held.cardState)
        assertEquals(DhikrTap.Ignored, DhikrBoardRun.choose(held, answerAt(held), rows))
    }

    @Test
    fun aHeldDhikrIsReplacedByAnotherDhikr() {
        val rng = TaskRng.seeded(SEED)
        val start = DhikrBoardRun.start(rows, emptyList(), rng)
        val held = checkNotNull(DhikrBoardRun.choose(start, (answerAt(start) + 1) % ANSWER_CARD_PLACE.size, rows).state)
        val next = DhikrBoardRun.replace(held, rows, rng)
        assertNotEquals(rows[start.round.row].sourceId, rows[next.round.row].sourceId)
        assertEquals(listOf(start.round.row, next.round.row), next.seen)
        assertEquals(DhikrPhase.ASKING, next.phase)
        assertEquals(1, next.replaced)
        assertFalse(next.gapFilled)
        assertFalse(next.noteShown)
        assertTrue(next.anotherShown)
        assertEquals(DhikrLabel.ANOTHER, next.label)
        assertEquals(AnswerCardState.REST, next.cardState)
    }

    @Test
    fun theFirstDhikrIsSaidWithItsGapAndNoOtherLine() {
        val start = DhikrBoardRun.start(rows, emptyList(), TaskRng.seeded(SEED))
        assertEquals(DhikrLabel.SPOKEN, start.label)
        assertFalse(start.anotherShown)
        assertFalse(start.noteShown)
    }

    @Test
    fun onlyAHeldBoardIsReplaced() {
        val start = DhikrBoardRun.start(rows, emptyList(), TaskRng.seeded(SEED))
        val solved = checkNotNull(DhikrBoardRun.choose(start, answerAt(start), rows).state)
        for (state in listOf(start, solved)) {
            assertEquals(state.phase.name, state, DhikrBoardRun.replace(state, rows, TaskRng.seeded(SEED)))
        }
    }

    @Test
    fun anEmptyGapsTextNeverHoldsTheAnswer() {
        for (row in rows) {
            assertFalse(row.answer, DhikrGap.textOf(row, filled = false).contains(row.answer))
            assertEquals(row.answer, DhikrGap.textOf(row, filled = true))
        }
    }

    @Test
    fun aFilledGapNeverPassesTheLineAndItsWordShrinksToFit() {
        assertEquals(DhikrGap.Fit(96f, 1f), DhikrGap.fitOf(word = 40f, inline = 8f, minWidth = 96f, available = 300f))
        assertEquals(DhikrGap.Fit(216f, 1f), DhikrGap.fitOf(word = 200f, inline = 8f, minWidth = 96f, available = 300f))
        assertEquals(DhikrGap.Fit(416f, 1f), DhikrGap.fitOf(word = 400f, inline = 8f, minWidth = 96f, available = 0f))
        val tight = DhikrGap.fitOf(word = 400f, inline = 8f, minWidth = 96f, available = 300f)
        assertEquals(300f, tight.width, 0f)
        assertEquals(284f, 400f * tight.scale, 0.001f)
    }

    @Test
    fun theGapsBoxIsCentredOnTheInkAndNeverShorterThanItsLeast() {
        val short = DhikrGap.boxOf(ascent = -28f, descent = 7f, minHeight = 48f)
        assertEquals(48f, short.bottom - short.top, 0f)
        assertEquals(-21f, short.top + short.bottom, 0f)
        assertTrue(short.top < -28f && short.bottom > 7f)
        assertEquals(DhikrGap.Box(-60f, 20f), DhikrGap.boxOf(ascent = -60f, descent = 20f, minHeight = 48f))
    }

    @Test
    fun theHoldWaitsLongerForAScreenReaderAndALongDhikr() {
        assertEquals(DhikrBoardRun.HOLD_MS, DhikrBoardRun.holdMs(screenReader = false, spokenLength = LONG_LINE))
        assertEquals(DhikrBoardRun.READER_HOLD_MS, DhikrBoardRun.holdMs(screenReader = true, spokenLength = 1))
        assertEquals(
            LONG_LINE * DhikrBoardRun.SPOKEN_MS_PER_CHARACTER,
            DhikrBoardRun.holdMs(screenReader = true, spokenLength = LONG_LINE),
        )
    }

    private fun answerAt(state: DhikrBoardState) = state.round.cards.indexOf(rows[state.round.row].answer)

    private companion object {
        const val SEED = 11L
        const val OTHERS_AT = 5
        const val CARDS_AT = 5
        const val CELL_JOIN = "|"

        // Past READER_HOLD_MS at SPOKEN_MS_PER_CHARACTER.
        const val LONG_LINE = 200L
    }
}
