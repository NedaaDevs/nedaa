package dev.nedaa.android.widgets.data

import dev.nedaa.android.widgets.common.SnapshotQada
import org.junit.Assert.assertEquals
import org.junit.Test

class QadaDataServiceTest {

    private val qada = SnapshotQada(date = 20260906, totalMissed = 30, totalCompleted = 12, completedToday = 1)

    @Test
    fun `a fresh snapshot copies through`() {
        assertEquals(QadaSummary(30, 12, 1), QadaDataService.summaryFrom(qada, 20260906))
    }

    @Test
    fun `after midnight today's count is zero but totals are last known`() {
        assertEquals(QadaSummary(30, 12, 0), QadaDataService.summaryFrom(qada, 20260907))
    }

    @Test
    fun `no snapshot is the empty summary`() {
        assertEquals(QadaSummary.empty(), QadaDataService.summaryFrom(null, 20260906))
    }
}
