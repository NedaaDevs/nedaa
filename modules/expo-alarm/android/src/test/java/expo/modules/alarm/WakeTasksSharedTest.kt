package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

// Same tables as src/utils/__tests__/wakeTasksNative.test.ts.
class WakeTasksSharedTest {

    private fun table(name: String): List<List<String>> {
        val stream = checkNotNull(javaClass.classLoader?.getResourceAsStream(name)) {
            "missing fixture $name"
        }
        return stream.bufferedReader(Charsets.UTF_8).use { it.readLines() }
            .drop(1)
            .filter { it.isNotEmpty() }
            .map { it.split('\t') }
    }

    // "-" stands for an empty field, which a fixture never holds.
    private fun cell(value: String): String = if (value == EMPTY) "" else value

    private fun list(value: String): List<String> = cell(value).split(',').filter { it.isNotEmpty() }

    @Test
    fun everyBoardOffersTheOptionsJsOffers() {
        val shared = table("wake-task-boards.tsv").map { (id, difficulty, steps) ->
            listOf(id, difficulty == YES, list(steps).map(String::toInt).ifEmpty { null })
        }
        val native = WakeTasks.Board.entries.map { listOf(it.id, it.hasDifficulty, it.stepChoices) }
        assertEquals(shared, native)
    }

    @Test
    fun theLimitsAreTheValuesJsUses() {
        val shared = table("wake-task-limits.tsv").associate { (name, value) -> name to value }
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
        for ((input, stack) in table("wake-task-stack.tsv")) {
            val tasks = WakeTasks.normalize(WakeTasks.decode(cell(input)))
            assertEquals("input $input", cell(stack), WakeTasks.encode(tasks))
        }
    }

    @Test
    fun aStacksChallengeIsTheOneJsDerives() {
        for ((stack, type, difficulty, count) in table("wake-task-challenge.tsv")) {
            val tasks = WakeTasks.normalize(WakeTasks.decode(cell(stack)))
            val expected = WakeTasks.Challenge(type, difficulty, count.toInt())
            assertEquals("stack $stack", expected, WakeTasks.challengeOf(tasks))
        }
    }

    @Test
    fun aSavedRowYieldsTheStackJsReads() {
        for ((type, difficulty, count, stored, stack) in table("wake-task-saved.tsv")) {
            val saved = WakeTasks.Challenge(type, difficulty, count.toInt())
            val text = if (stored == ABSENT) null else cell(stored)
            val tasks = WakeTasks.resolve(saved, text)
            assertEquals("$type $difficulty $count $stored", cell(stack), WakeTasks.encode(tasks))
        }
    }

    private companion object {
        const val EMPTY = "-"
        const val YES = "yes"
        const val ABSENT = "absent"
    }
}
