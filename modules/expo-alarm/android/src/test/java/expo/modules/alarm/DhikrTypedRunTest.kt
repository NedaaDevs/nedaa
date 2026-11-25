package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

// Same tables as the JS test in src/utils/__tests__/dhikrChallenge.test.ts.
class DhikrTypedRunTest {

    @Test
    fun submitsEverySharedCase() {
        for ((case, arabic, transliteration, typed, outcomes) in sharedTable("dhikr-typed.tsv")) {
            val phrase = DhikrPhrase(arabic, transliteration)
            var strikes = 0
            val seen = typed.split(SEPARATOR).map { cell ->
                val submitted = DhikrTypedRun.submit(if (cell == FIXTURE_NONE) "" else cell, phrase, strikes)
                strikes = submitted.strikes
                submitted.outcome.id
            }
            assertEquals(case, outcomes, seen.joinToString(SEPARATOR))
        }
    }

    @Test
    fun typesThePoolTheAppTypes() {
        val rows = ChallengeDifficulty.entries.flatMap { difficulty ->
            DhikrTypedRun.PHRASES.getValue(difficulty).map { listOf(difficulty.id, it.arabic, it.transliteration) }
        }
        assertEquals(sharedTable("dhikr-phrases.tsv"), rows)
    }

    @Test
    fun aDhikrTaskTypesTheEasyPool() {
        val task = WakeTasks.normalize(WakeTasks.decode("id=${WakeTasks.Board.DHIKR.id},steps=3")).single()
        assertEquals(DhikrTypedRun.PHRASES.getValue(ChallengeDifficulty.EASY), DhikrTypedRun.poolOf(task))
    }

    @Test
    fun aPickNeverRepeatsThePreviousPhrase() {
        val rng = TaskRng.seeded(SEED)
        for (size in 2..4) for (previous in 0 until size) repeat(DRAWS) {
            val picked = DhikrTypedRun.pick(size, previous, rng)
            assertNotEquals("$size $previous", previous, picked)
            assertEquals(true, picked in 0 until size)
        }
    }

    @Test
    fun aPickReachesEveryOtherPhrase() {
        val rng = TaskRng.seeded(SEED)
        val seen = (1..DRAWS).map { DhikrTypedRun.pick(3, 1, rng) }.toSet()
        assertEquals(setOf(0, 2), seen)
    }

    @Test
    fun aFirstPickMayBeAnyPhrase() {
        val rng = TaskRng.seeded(SEED)
        assertEquals((0..2).toSet(), (1..DRAWS).map { DhikrTypedRun.pick(3, null, rng) }.toSet())
    }

    @Test
    fun aOnePhrasePoolPicksIt() {
        assertEquals(0, DhikrTypedRun.pick(1, 0, TaskRng.seeded(SEED)))
    }

    private companion object {
        const val SEPARATOR = "|"
        const val SEED = 20261125L
        const val DRAWS = 60
    }
}
