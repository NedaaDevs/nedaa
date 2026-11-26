package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

// Each ringing rule's locale key draws the resource ringing-strings.tsv names.
class RingingStringsTest {

    private fun stringNamed(name: String): Int = R.string::class.java.getField(name).getInt(null)

    @Test
    fun everyKeyDrawsItsNamedString() {
        val byKey = sharedTable("ringing-strings.tsv").associate { (key, resource) -> key to resource }
        // Through the Name overload the header view calls.
        val names: List<RingingScreen.Name> = RingingScreen.Prayer.entries + RingingScreen.AlarmName.entries
        val drawn = names.map { it.key to RingingStrings.of(it) } +
            RingingScreen.Heading.entries.map { it.key to RingingStrings.of(it) } +
            RingingScreen.Announcement.entries.map { it.key to RingingStrings.of(it) } +
            RingingScreen.SnoozePlace.entries.mapNotNull { place -> RingingStrings.of(place)?.let { place.key to it } }
        assertEquals(byKey.keys, drawn.map { it.first }.toSet())
        for ((key, id) in drawn) assertEquals(key, stringNamed(byKey.getValue(key)), id)
    }
}
