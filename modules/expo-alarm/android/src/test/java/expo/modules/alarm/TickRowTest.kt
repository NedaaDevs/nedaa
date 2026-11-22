package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TickRowTest {

    private val ticks = 0 until TapPress.PRESSES

    @Test
    fun aWideRowKeepsFullPillsAndCentresThem() {
        val shown = TickRow.layout(room = 400f, widest = 24f, gap = 6f, count = 10)
        assertEquals(24f, shown.width, 0f)
        assertEquals((400f - 294f) / 2f, shown.start, 0f)
    }

    @Test
    fun aNarrowRowNarrowsThePillsToFitExactly() {
        val shown = TickRow.layout(room = 200f, widest = 24f, gap = 6f, count = 10)
        assertEquals(200f, shown.width * 10 + 6f * 9, 0.001f)
        assertEquals(0f, shown.start, 0f)
    }

    @Test
    fun noRoomGivesPillsNoWidth() {
        val shown = TickRow.layout(room = 0f, widest = 24f, gap = 6f, count = 10)
        assertEquals(0f, shown.width, 0f)
        assertEquals(0f, shown.start, 0f)
    }

    @Test
    fun aPillNoWiderThanItsEdgeIsNotDrawn() {
        assertFalse(TickRow.drawable(TickRow.Shown(start = 0f, width = 2f), edge = 2f))
        assertTrue(TickRow.drawable(TickRow.Shown(start = 0f, width = 2.5f), edge = 2f))
    }

    @Test
    fun pillsStepFromTheStartEdge() {
        val shown = TickRow.Shown(start = 10f, width = 24f)
        assertEquals(10f, TickRow.leftOf(0, room = 400f, shown, gap = 6f, rtl = false), 0f)
        assertEquals(40f, TickRow.leftOf(1, room = 400f, shown, gap = 6f, rtl = false), 0f)
    }

    @Test
    fun inRtlTheFirstPillEndsAtTheStartEdge() {
        val shown = TickRow.Shown(start = 10f, width = 24f)
        val left = TickRow.leftOf(0, room = 400f, shown, gap = 6f, rtl = true)
        assertEquals(400f - shown.start, left + shown.width, 0f)
    }

    @Test
    fun aPillIsFilledForEachCountedPress() {
        assertEquals(emptyList<Int>(), ticks.filter { TickRow.filled(it, done = 0) })
        assertEquals(listOf(0), ticks.filter { TickRow.filled(it, done = 1) })
        assertEquals(ticks.toList(), ticks.filter { TickRow.filled(it, done = TapPress.PRESSES) })
    }
}
