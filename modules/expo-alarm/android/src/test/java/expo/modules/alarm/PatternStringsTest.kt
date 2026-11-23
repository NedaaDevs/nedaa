package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

// Each pad's strings are the ones named for it and for where the grid draws it.
class PatternStringsTest {

    private fun stringNamed(name: String): Int = R.string::class.java.getField(name).getInt(null)

    @Test
    fun everyPadIsNamedByItsOwnString() {
        for (pad in PatternPad.entries) {
            assertEquals(pad.id, stringNamed("overlay_task_pattern_pad_${pad.id}"), padNameOf(pad))
        }
    }

    @Test
    fun everyPadIsPlacedWhereTheGridDrawsIt() {
        PatternPad.entries.forEachIndexed { index, pad ->
            val row = if (index / PATTERN_COLUMNS == 0) "top" else "bottom"
            val column = if (index % PATTERN_COLUMNS == 0) "left" else "right"
            assertEquals(pad.id, stringNamed("overlay_task_pattern_place_${row}_$column"), placeOf(pad))
        }
    }
}
