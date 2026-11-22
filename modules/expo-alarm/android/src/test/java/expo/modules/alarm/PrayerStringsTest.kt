package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

// Each prayer's strings are the ones named for it, so a swapped pair fails.
class PrayerStringsTest {

    private fun stringNamed(name: String): Int = R.string::class.java.getField(name).getInt(null)

    @Test
    fun everyPrayerIsNamedByItsOwnString() {
        for (prayer in PrayerId.entries) {
            assertEquals(prayer.id, stringNamed("overlay_prayer_${prayer.id}"), nameIdOf(prayer))
        }
    }

    @Test
    fun everyPlaceIsSaidByItsOwnStrings() {
        for (prayer in PrayerId.entries) {
            val place = placeIdOf(prayer)
            assertEquals(prayer.id, stringNamed("overlay_task_prayers_empty_${prayer.id}"), place.empty)
            assertEquals(prayer.id, stringNamed("overlay_task_prayers_filled_${prayer.id}"), place.filled)
        }
    }
}
