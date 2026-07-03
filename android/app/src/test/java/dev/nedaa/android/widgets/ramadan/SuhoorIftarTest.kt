package dev.nedaa.android.widgets.ramadan

import dev.nedaa.android.widgets.importantdays.ImportantDay
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SuhoorIftarTest {

    @Test
    fun `ramadan sooner than eid means Ramadan has not started`() {
        val days = listOf(
            ImportantDay(id = "ramadan", name = "Ramadan", hijriLabel = "1 Ramadan 1448", dateISO = "2027-02-08"),
            ImportantDay(id = "eid-al-fitr", name = "Eid al-Fitr", hijriLabel = "1 Shawwal 1448", dateISO = "2027-03-10")
        )
        assertFalse(SuhoorIftarWidget.isRamadan(days))
    }

    @Test
    fun `eid sooner than ramadan means we are inside Ramadan`() {
        val days = listOf(
            ImportantDay(id = "ramadan", name = "Ramadan", hijriLabel = "1 Ramadan 1449", dateISO = "2028-01-28"),
            ImportantDay(id = "eid-al-fitr", name = "Eid al-Fitr", hijriLabel = "1 Shawwal 1448", dateISO = "2027-03-10")
        )
        assertTrue(SuhoorIftarWidget.isRamadan(days))
    }

    @Test
    fun `missing eid row means not Ramadan`() {
        val days = listOf(
            ImportantDay(id = "ramadan", name = "Ramadan", hijriLabel = "1 Ramadan 1448", dateISO = "2027-02-08")
        )
        assertFalse(SuhoorIftarWidget.isRamadan(days))
    }
}
