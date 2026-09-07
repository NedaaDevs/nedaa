package dev.nedaa.android.widgets.data

import dev.nedaa.android.widgets.common.SnapshotAthkar
import dev.nedaa.android.widgets.common.SnapshotSession
import dev.nedaa.android.widgets.common.SnapshotStreak
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AthkarDataServiceTest {

    private val today = 20260906
    private val athkar = SnapshotAthkar(
        date = today,
        morning = SnapshotSession(22, 22, "2026-09-06T04:10:00.000Z"),
        evening = SnapshotSession(3, 22, null),
        streak = SnapshotStreak(5, 12),
    )

    @Test
    fun `a fresh snapshot fills every field`() {
        val s = AthkarDataService.summaryFrom(athkar, today)
        assertTrue(s.morningCompleted)
        assertFalse(s.eveningCompleted)
        assertEquals(5, s.currentStreak)
        assertEquals(12, s.longestStreak)
        assertEquals(25, s.completedItems)
        assertEquals(44, s.totalItems)
    }

    @Test
    fun `after midnight today's progress is zero but the streak is last known`() {
        val s = AthkarDataService.summaryFrom(athkar, 20260907)
        assertFalse(s.morningCompleted)
        assertFalse(s.eveningCompleted)
        assertEquals(0, s.completedItems)
        assertEquals(44, s.totalItems)
        assertEquals(5, s.currentStreak)
    }

    @Test
    fun `no snapshot is the empty summary`() {
        assertEquals(AthkarSummary.empty(), AthkarDataService.summaryFrom(null, today))
    }

    @Test
    fun `session progress reads one session and zeroes it when stale`() {
        assertEquals(Pair(22, 22), AthkarDataService.sessionFrom(athkar, today, "morning"))
        assertEquals(Pair(3, 22), AthkarDataService.sessionFrom(athkar, today, "evening"))
        assertEquals(Pair(0, 22), AthkarDataService.sessionFrom(athkar, 20260907, "morning"))
        assertEquals(Pair(0, 0), AthkarDataService.sessionFrom(null, today, "morning"))
    }
}
