package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

class RedeliveredStartTest {

    @Test
    fun aFreshStartRingsEvenForACompletedAlarm() {
        assertEquals(RedeliveredStart.Action.RING, RedeliveredStart.actionFor(false, completed = true, ringing = false))
    }

    @Test
    fun aRedeliveredOpenAlarmRings() {
        assertEquals(RedeliveredStart.Action.RING, RedeliveredStart.actionFor(true, completed = false, ringing = false))
        assertEquals(RedeliveredStart.Action.RING, RedeliveredStart.actionFor(true, completed = null, ringing = true))
    }

    // The quiet's re-ring may already ring when the ended alarm is redelivered.
    @Test
    fun aRedeliveredEndedAlarmNeverStopsARing() {
        assertEquals(RedeliveredStart.Action.SKIP, RedeliveredStart.actionFor(true, completed = true, ringing = true))
    }

    @Test
    fun aRedeliveredEndedAlarmWithNoRingEndsOnlyItsStart() {
        assertEquals(
            RedeliveredStart.Action.SKIP_AND_STOP_THIS_START,
            RedeliveredStart.actionFor(true, completed = true, ringing = false),
        )
    }
}
