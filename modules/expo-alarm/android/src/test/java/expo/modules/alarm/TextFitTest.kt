package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
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

    @Test
    fun aLineFitsWhenBothItsWidthAndHeightFit() {
        assertTrue(TextFit.fitsBox(width = 100f, lineHeight = 70f, roomWidth = 100, roomHeight = 73))
        assertFalse(TextFit.fitsBox(width = 101f, lineHeight = 70f, roomWidth = 100, roomHeight = 73))
    }

    @Test
    fun aShortLineTooTallForItsBoxDoesNotFit() {
        assertFalse(TextFit.fitsBox(width = 40f, lineHeight = 120f, roomWidth = 300, roomHeight = 73))
    }

    @Test
    fun aBoxWithNoHeightYetChecksOnlyTheWidth() {
        assertTrue(TextFit.fitsBox(width = 40f, lineHeight = 120f, roomWidth = 300, roomHeight = 0))
    }
}
