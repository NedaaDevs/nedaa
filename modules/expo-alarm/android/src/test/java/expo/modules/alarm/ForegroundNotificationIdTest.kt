package expo.modules.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

// A shared id lets one service's notice replace, then remove, another's.
class ForegroundNotificationIdTest {

    @Test
    fun eachForegroundServiceHasItsOwnNotificationId() {
        val ids = listOf(
            AlarmNotificationManager.NOTIFICATION_ID,
            AlarmNotificationManager.OVERLAY_NOTIFICATION_ID,
            AthanNotificationManager.NOTIFICATION_ID,
        )
        assertEquals(ids.size, ids.toSet().size)
    }
}
