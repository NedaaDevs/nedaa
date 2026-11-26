package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

// Same tables as src/utils/__tests__/wakeTasksNative.test.ts.
class WakeTasksSharedTest {

    // "-" stands for an empty field, which a fixture never holds.
    private fun cell(value: String): String = if (value == FIXTURE_NONE) "" else value

    private fun list(value: String): List<String> = cell(value).split(',').filter { it.isNotEmpty() }

    @Test
    fun everyBoardOffersTheOptionsJsOffers() {
        val shared = sharedTable("wake-task-boards.tsv").map { (id, difficulty, steps) ->
            listOf(id, difficulty == FIXTURE_YES, list(steps).map(String::toInt).ifEmpty { null })
        }
        val native = WakeTasks.Board.entries.map { listOf(it.id, it.hasDifficulty, it.stepChoices) }
        assertEquals(shared, native)
    }

    @Test
    fun theLimitsAreTheValuesJsUses() {
        val shared = sharedTable("wake-task-limits.tsv").associate { (name, value) -> name to value }
        val native = mapOf(
            "MAX_STACK" to WakeTasks.MAX_STACK.toString(),
            "DEFAULT_DIFFICULTY" to WakeTasks.DEFAULT_DIFFICULTY,
            "DEFAULT_STEPS" to WakeTasks.DEFAULT_STEPS.toString(),
            "DIFFICULTIES" to WakeTasks.DIFFICULTIES.joinToString(","),
            "CHALLENGE_TYPES" to WakeTasks.CHALLENGE_TYPES.joinToString(","),
        )
        assertEquals(shared, native)
    }

    @Test
    fun aStackFromTheBridgeIsKeptToWhatJsKeeps() {
        for ((input, stack) in sharedTable("wake-task-stack.tsv")) {
            val tasks = WakeTasks.normalize(WakeTasks.decode(cell(input)))
            assertEquals("input $input", cell(stack), WakeTasks.encode(tasks))
        }
    }

    @Test
    fun aStacksChallengeIsTheOneJsDerives() {
        for ((stack, type, difficulty, count) in sharedTable("wake-task-challenge.tsv")) {
            val tasks = WakeTasks.normalize(WakeTasks.decode(cell(stack)))
            val expected = WakeTasks.Challenge(type, difficulty, count.toInt())
            assertEquals("stack $stack", expected, WakeTasks.challengeOf(tasks))
        }
    }

    @Test
    fun aSavedRowYieldsTheStackJsReads() {
        for ((type, difficulty, count, stored, stack) in sharedTable("wake-task-saved.tsv")) {
            val saved = WakeTasks.Challenge(type, difficulty, count.toInt())
            val text = if (stored == ABSENT) null else cell(stored)
            val tasks = WakeTasks.resolve(saved, text)
            assertEquals("$type $difficulty $count $stored", cell(stack), WakeTasks.encode(tasks))
        }
    }

    private companion object {
        const val ABSENT = "absent"
    }
}
