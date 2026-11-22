package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

class TextFitTest {

    // A text that fits at `limit` sp and below.
    private fun fitsAt(limit: Float): (Float) -> Boolean = { sp -> sp <= limit }

    @Test
    fun keepsTheLargestSizeWhenTheTextFits() {
        assertEquals(96f, TextFit.sp(96f, 40f, fitsAt(200f)), 0f)
    }

    @Test
    fun shrinksToTheLargestSizeThatFits() {
        assertEquals(71f, TextFit.sp(96f, 40f, fitsAt(71.5f)), 0f)
    }

    @Test
    fun stopsAtTheSmallestSize() {
        assertEquals(40f, TextFit.sp(96f, 40f, fitsAt(10f)), 0f)
    }
}
