package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

// task-clock.tsv: each case runs its ops in order on one clock, as the JS
// test does, and checks the clock and what it shows after each op.
class TaskClockTest {

    private data class Row(val cells: List<String>) {
        val case get() = cells[0]
        val op get() = cells[1]
        val now get() = cells[2].toLong()
        val audible get() = cells[3].toBooleanStrict()
        val screenReader get() = cells[4].toBooleanStrict()
    }

    private val cases = sharedTable("task-clock.tsv").map(::Row).groupBy { it.case }

    private fun quietMs(screenReader: Boolean) =
        TaskClock.quietSecondsFor(screenReader) * TaskClock.SECOND_MS

    // Reads every tick from the last counted moment up to `to`.
    private fun ticks(clock: TaskClock, to: Long, audible: Boolean): TaskClock {
        var out = clock
        var at = clock.countedTo + TaskClock.TICK_MS
        while (at <= to) {
            out = out.advance(at, audible)
            at += TaskClock.TICK_MS
        }
        return out
    }

    private fun apply(clock: TaskClock?, row: Row): TaskClock = when (row.op) {
        FixtureOp.START -> TaskClock.start(row.now, quietMs(row.screenReader))
        FixtureOp.ADVANCE -> checkNotNull(clock).advance(row.now, row.audible)
        FixtureOp.TICKS -> ticks(checkNotNull(clock), row.now, row.audible)
        FixtureOp.RESTART -> checkNotNull(clock).restartQuiet(row.now, quietMs(row.screenReader), row.audible)
        FixtureOp.END -> checkNotNull(clock).endQuiet(row.now, row.audible)
        FixtureOp.RESUME -> checkNotNull(clock).resume(row.now)
        else -> error("unknown op ${row.op}")
    }

    private fun shown(clock: TaskClock, now: Long): List<String> = listOf(
        clock.quietUntil.toString(),
        clock.quietMs.toString(),
        clock.soundingMs.toString(),
        clock.countedTo.toString(),
        clock.quietPhase(now).name.lowercase(),
        clock.quietSecondsLeft(now).toString(),
        clock.quietFraction(now, stepped = false).toString(),
        clock.quietFraction(now, stepped = true).toString(),
        clock.wayOutShown.toString(),
    )

    // JS prints whole doubles without ".0"; compare as numbers there.
    private fun same(expected: String, actual: String) =
        expected == actual || expected.toDoubleOrNull()?.let { it == actual.toDoubleOrNull() } == true

    @Test
    fun everyCaseMatchesJs() {
        for ((name, rows) in cases) {
            var clock: TaskClock? = null
            for (row in rows) {
                val next = apply(clock, row)
                clock = next
                val expected = row.cells.drop(EXPECTED_FROM)
                val actual = shown(next, row.now)
                assertEquals("$name: columns", expected.size, actual.size)
                val mismatched = expected.indices.filter { !same(expected[it], actual[it]) }
                assertEquals("$name: ${row.op} at ${row.now}: $actual", emptyList<Int>(), mismatched)
            }
        }
    }

    @Test
    fun theTableReachesTheWayOut() {
        val wayOut = cases.values.flatten().filter { it.cells.last().toBooleanStrict() }
        assertEquals(true, wayOut.isNotEmpty())
    }

    private companion object {
        const val EXPECTED_FROM = 5
    }
}
