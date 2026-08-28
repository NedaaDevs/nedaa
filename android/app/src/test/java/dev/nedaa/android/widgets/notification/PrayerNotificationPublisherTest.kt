package dev.nedaa.android.widgets.notification

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PrayerNotificationPublisherTest {

    @Test
    fun `disabled flag prevents publishing`() {
        assertFalse(PrayerNotificationPublisher.shouldPublish(false, true))
    }

    @Test
    fun `enabled flag still requires notification permission`() {
        assertFalse(PrayerNotificationPublisher.shouldPublish(true, false))
        assertTrue(PrayerNotificationPublisher.shouldPublish(true, true))
    }
}
