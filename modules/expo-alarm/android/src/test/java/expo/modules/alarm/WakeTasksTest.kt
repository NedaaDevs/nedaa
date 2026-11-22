package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

class WakeTasksTest {

    private val math = WakeTasks.Task(WakeTasks.Board.MATH, "hard", 4)
    private val tap = WakeTasks.Task(WakeTasks.Board.TAP, null, null)
    private val dhikr = WakeTasks.Task(WakeTasks.Board.DHIKR, null, 3)

    @Test
    fun aRowFromBeforeVersionSixIsItsChallengeAsOneTask() {
        val saved = WakeTasks.Challenge("math", "hard", 4)
        assertEquals(listOf(math), WakeTasks.resolve(saved, stored = null))
    }

    @Test
    fun aStoredStackSurvivesTheRoundTrip() {
        val stack = listOf(dhikr, tap, math)
        assertEquals(stack, WakeTasks.normalize(WakeTasks.decode(WakeTasks.encode(stack))))
    }

    @Test
    fun anEmptyStackIsStoredAsEmptyText() {
        assertEquals("", WakeTasks.encode(emptyList()))
        assertEquals(emptyList<WakeTasks.Task>(), WakeTasks.normalize(WakeTasks.decode("")))
    }

    @Test
    fun theBridgeSendsEachTaskWithOnlyItsBoardsOptions() {
        val expected = listOf(
            mapOf("id" to "math", "difficulty" to "hard", "steps" to 4),
            mapOf("id" to "tap"),
            mapOf("id" to "dhikr", "steps" to 3),
        )
        assertEquals(expected, WakeTasks.toBridge(listOf(math, tap, dhikr)))
    }

    @Test
    fun aBridgeListIsReadAsJsSendsIt() {
        val sent = listOf(
            mapOf("id" to "math", "difficulty" to "hard", "steps" to 4.0),
            "not a task",
            mapOf("id" to "tap"),
        )
        assertEquals(listOf(math, tap), WakeTasks.normalize(sent))
    }

    @Test
    fun aValueThatIsNotAListIsNoStack() {
        assertEquals(emptyList<WakeTasks.Task>(), WakeTasks.normalize("tap"))
        assertEquals(emptyList<WakeTasks.Task>(), WakeTasks.normalize(null))
    }

    @Test
    fun theOverlaysChallengeIsTheFirstTask() {
        assertEquals(WakeTasks.Challenge("math", "hard", 4), WakeTasks.challengeOf(listOf(math, tap)))
        assertEquals(WakeTasks.Challenge("none", "easy", 1), WakeTasks.challengeOf(emptyList()))
        assertEquals(WakeTasks.DEFAULT_CHALLENGE, WakeTasks.challengeOf(listOf(tap, math)))
    }

    private val stored = WakeTasks.Stored(WakeTasks.Challenge("dhikr", "easy", 3), listOf(dhikr))

    @Test
    fun aSentStackWinsAndSetsTheChallenge() {
        val sent = listOf(mapOf("id" to "math", "difficulty" to "hard", "steps" to 4), mapOf("id" to "tap"))
        val written = WakeTasks.write(stored, sent, WakeTasks.Challenge("tap", "easy", 9))
        assertEquals(WakeTasks.Stored(WakeTasks.Challenge("math", "hard", 4), listOf(math, tap)), written)
    }

    @Test
    fun aSentChallengeAloneRebuildsTheStack() {
        val written = WakeTasks.write(stored, null, WakeTasks.Challenge("math", "hard", 4))
        assertEquals(WakeTasks.Stored(WakeTasks.Challenge("math", "hard", 4), listOf(math)), written)
    }

    @Test
    fun aSentChallengeIsKeptToItsChoices() {
        val written = WakeTasks.write(stored, null, WakeTasks.Challenge("math", "wild", 40))
        val challenge = WakeTasks.Challenge("math", "medium", 10)
        assertEquals(WakeTasks.Stored(challenge, WakeTasks.fromChallenge(challenge)), written)
    }

    @Test
    fun aWriteWithNeitherKeepsBoth() {
        assertEquals(stored, WakeTasks.write(stored, null, null))
    }
}
