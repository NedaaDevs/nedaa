package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

class AlarmSchedulerRuleTest {

    @Test
    fun onlyAnOpenSavedRowKeepsTheEntryArmedAfterAFailedSave() {
        val kept = listOf(false, true, null).map(AlarmScheduler::keepsArmedAfterFailedSave)
        assertEquals(listOf(true, false, false), kept)
    }
}
