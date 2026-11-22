package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

// quiet-step.tsv: each case runs its ops on one reading, as the JS test does,
// and checks the reading and the sound changes each op sent.
class TaskQuietTest {

    private data class Row(val cells: List<String>) {
        val case get() = cells[0]
        val op get() = cells[1]
        val now get() = cells[2].toLong()
        val audible get() = cells[3].toBooleanStrict()
        val screenReader get() = cells[4].toBooleanStrict()
        val expected get() = cells.subList(5, 10)
        val signals get() = if (cells[10] == FIXTURE_NONE) emptyList() else cells[10].split(',')
    }

    private val cases = sharedTable("quiet-step.tsv").map(::Row).groupBy { it.case }

    private fun apply(reading: TaskQuiet.Reading?, row: Row): Pair<TaskQuiet.Reading, List<String>> {
        val quietMs = TaskClock.quietSecondsFor(row.screenReader) * TaskClock.SECOND_MS
        if (row.op == FixtureOp.START) return TaskQuiet.Reading(TaskClock.start(row.now, quietMs), row.now) to emptyList()
        var out = checkNotNull(reading) { "${row.op} before start" }
        if (row.op == FixtureOp.RESUME) return TaskQuiet.Reading(out.clock.resume(row.now), row.now) to emptyList()
        val sent = mutableListOf<String>()
        fun send(event: TaskQuiet.Event, at: Long) {
            val step = TaskQuiet.step(out, event, at, quietMs, row.audible)
            out = step.reading
            step.signal?.let { sent += it.id }
        }
        if (row.op == FixtureOp.TICKS) {
            var at = out.now + TaskClock.TICK_MS
            while (at <= row.now) {
                send(TaskQuiet.Event.TICK, at)
                at += TaskClock.TICK_MS
            }
        } else {
            send(checkNotNull(TaskQuiet.Event.entries.firstOrNull { it.id == row.op }) { "unknown op ${row.op}" }, row.now)
        }
        return out to sent
    }

    @Test
    fun everyCaseMatchesJs() {
        check(cases.isNotEmpty())
        for ((name, rows) in cases) {
            rows.fold<Row, TaskQuiet.Reading?>(null) { reading, row ->
                val (next, sent) = apply(reading, row)
                val clock = next.clock
                val shown = listOf(clock.quietUntil, clock.quietMs, clock.soundingMs, clock.countedTo, next.now).map { "$it" }
                assertEquals("$name: ${row.op} ${row.now}", row.expected, shown)
                assertEquals("$name: ${row.op} ${row.now} signals", row.signals, sent)
                next
            }
        }
    }
}
