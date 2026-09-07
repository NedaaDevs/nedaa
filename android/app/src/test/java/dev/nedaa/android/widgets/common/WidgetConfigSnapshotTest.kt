package dev.nedaa.android.widgets.common

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Locale
import java.util.TimeZone

class WidgetConfigSnapshotTest {

    @Test
    fun `no snapshot falls back to the device zone, no offset and no Western preference`() {
        val c = WidgetConfig.fromSnapshot(null, Locale("ar"))
        assertEquals(TimeZone.getDefault().id, c.timezone.id)
        assertEquals(0, c.hijriDaysOffset)
        assertTrue(c.arabicNumerals)
    }

    @Test
    fun `the snapshot zone and offset win over the device`() {
        val c = WidgetConfig.fromSnapshot(SnapshotConfig(false, "Asia/Riyadh", -1), Locale.US)
        assertEquals("Asia/Riyadh", c.timezone.id)
        assertEquals(-1, c.hijriDaysOffset)
    }

    @Test
    fun `Arabic digits need both an Arabic locale and no Western preference`() {
        assertTrue(WidgetConfig.fromSnapshot(SnapshotConfig(false, "UTC", 0), Locale("ar")).arabicNumerals)
        assertFalse(WidgetConfig.fromSnapshot(SnapshotConfig(true, "UTC", 0), Locale("ar")).arabicNumerals)
        assertFalse(WidgetConfig.fromSnapshot(SnapshotConfig(false, "UTC", 0), Locale.US).arabicNumerals)
    }

    @Test
    fun `an empty timezone string is treated as absent`() {
        val c = WidgetConfig.fromSnapshot(SnapshotConfig(false, "", 0), Locale.US)
        assertEquals(TimeZone.getDefault().id, c.timezone.id)
    }
}
