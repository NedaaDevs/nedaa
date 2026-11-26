package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

class RedeliveredStartTest {

    @Test
    fun aFreshStartRingsEvenForAnEndedAlarm() {
        assertEquals(RedeliveredStart.Action.RING, RedeliveredStart.actionFor(false, ended = true, ringing = false))
    }

    @Test
    fun aRedeliveredOpenAlarmRings() {
        assertEquals(RedeliveredStart.Action.RING, RedeliveredStart.actionFor(true, ended = false, ringing = false))
        assertEquals(RedeliveredStart.Action.RING, RedeliveredStart.actionFor(true, ended = false, ringing = true))
    }

    // The quiet's re-ring may already ring when the ended alarm is redelivered.
    @Test
    fun aRedeliveredEndedAlarmNeverStopsARing() {
        assertEquals(RedeliveredStart.Action.SKIP, RedeliveredStart.actionFor(true, ended = true, ringing = true))
    }

    @Test
    fun aRedeliveredEndedAlarmWithNoRingEndsOnlyItsStart() {
        assertEquals(
            RedeliveredStart.Action.SKIP_AND_STOP_THIS_START,
            RedeliveredStart.actionFor(true, ended = true, ringing = false),
        )
    }

    // A row the app deleted reads as ended, as AlarmReceiver reads it.
    @Test
    fun anAlarmWithNoRowIsEnded() {
        assertEquals(listOf(true, true, false), listOf(null, true, false).map(RedeliveredStart::isEnded))
    }
}
