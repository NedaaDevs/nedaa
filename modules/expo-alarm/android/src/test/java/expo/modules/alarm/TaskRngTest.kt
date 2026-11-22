package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

// rng.tsv holds what the JS seededRng, drawInt and shuffled return.
class TaskRngTest {

    private val rows = sharedTable("rng.tsv")

    private fun rowsOf(op: String) = rows.filter { it[0] == op }

    @Test
    fun aSeedDrawsTheJsSequence() {
        for ((_, seed, count, values) in rowsOf(FixtureOp.NEXT)) {
            val rng = TaskRng.seeded(seed.toLong())
            val drawn = List(count.toInt()) { (rng.next() * UINT_RANGE).toLong() }
            assertEquals("seed $seed", values.split(',').map { it.toLong() }, drawn)
        }
    }

    @Test
    fun drawIntMatchesJs() {
        for ((_, seed, args, values) in rowsOf(FixtureOp.INT)) {
            val (min, max, count) = args.ints()
            val rng = TaskRng.seeded(seed.toLong())
            assertEquals("seed $seed", values.ints(), List(count) { TaskRng.drawInt(rng, min, max) })
        }
    }

    @Test
    fun shuffledMatchesJsAndLeavesTheInputAlone() {
        for ((_, seed, size, values) in rowsOf(FixtureOp.SHUFFLE)) {
            val items = List(size.toInt()) { it }
            val out = TaskRng.shuffled(items, TaskRng.seeded(seed.toLong()))
            assertEquals("seed $seed", values.ints(), out)
            assertEquals(List(size.toInt()) { it }, items)
        }
    }

    @Test
    fun aDrawAfterAShuffleMatchesJs() {
        for ((_, seed, args, values) in rowsOf(FixtureOp.SHUFFLE_INT)) {
            val (size, min, max) = args.ints()
            val rng = TaskRng.seeded(seed.toLong())
            val order = TaskRng.shuffled(List(size) { it }, rng)
            assertEquals("seed $seed", values.ints(), order + TaskRng.drawInt(rng, min, max))
        }
    }

    @Test
    fun drawsStayInRange() {
        val rng = TaskRng.seeded(9)
        repeat(1000) {
            val draw = rng.next()
            assertEquals(true, draw >= 0.0 && draw < 1.0)
        }
    }

    private companion object {
        const val UINT_RANGE = 4294967296.0
    }
}
