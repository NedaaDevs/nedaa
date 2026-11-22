package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

// math-round.tsv holds what the JS mathRound draws for each seed, with and
// without the question it replaces.
class MathCardsTest {

    private val rows = sharedTable("math-round.tsv")

    @Test
    fun aRoundMatchesJs() {
        for (row in rows) {
            val (id, seed, previous) = row
            val (left, right, answer, cards) = row.drop(3)
            val difficulty = checkNotNull(ChallengeDifficulty.fromId(id))
            val asked = previous.takeIf { it != FIXTURE_NONE }?.ints()?.let { (l, r) ->
                MathQuestion(MathCards.levelOf(difficulty).operation, l, r)
            }
            val round = MathCards.round(difficulty, TaskRng.seeded(seed.toLong()), asked)
            val drawn = listOf(round.question.left, round.question.right, round.answer)
            assertEquals("$id $seed after $previous", listOf(left, right, answer).map { it.toInt() }, drawn)
            assertEquals("$id $seed cards", cards.ints(), round.cards)
        }
    }

    @Test
    fun theTableCoversEveryDifficultyAndAWrap() {
        assertEquals(ChallengeDifficulty.entries.map { it.id }.toSet(), rows.map { it[0] }.toSet())
        val wraps = rows.filter { row ->
            row[2] != FIXTURE_NONE && row[4].toInt() < row[2].ints()[1]
        }
        assertEquals(true, wraps.isNotEmpty())
    }

    @Test
    fun aWrongAnswerNeverAsksTheSameAnswerAgain() {
        for (difficulty in ChallengeDifficulty.entries) {
            val rng = TaskRng.seeded(11)
            var round = MathCards.round(difficulty, rng)
            repeat(500) {
                val next = MathCards.round(difficulty, rng, round.question)
                assertNotEquals(round.answer, next.answer)
                round = next
            }
        }
    }

    @Test
    fun cardsHoldTheAnswerOnceAndStayPositive() {
        for (difficulty in ChallengeDifficulty.entries) {
            val rng = TaskRng.seeded(23)
            repeat(500) {
                val round = MathCards.round(difficulty, rng)
                assertEquals(1, round.cards.count { it == round.answer })
                assertEquals(MathCards.CARD_COUNT, round.cards.toSet().size)
                assertEquals(true, round.cards.all { it > 0 })
            }
        }
    }

}
