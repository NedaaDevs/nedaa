package dev.nedaa.android.widgets.data

import android.content.Context
import dev.nedaa.android.widgets.common.Snapshot
import dev.nedaa.android.widgets.common.SnapshotQada
import dev.nedaa.android.widgets.common.WidgetSnapshot
import java.util.TimeZone

/** Qada (missed fasts) totals for the widgets, read from the snapshot JS writes. */
class QadaDataService(private val context: Context) {

    companion object {
        /** Totals are last known; today's completions reset at midnight. */
        internal fun summaryFrom(qada: SnapshotQada?, today: Int): QadaSummary {
            if (qada == null) return QadaSummary.empty()
            return QadaSummary(
                totalMissed = qada.totalMissed,
                totalCompleted = qada.totalCompleted,
                todayCompleted = if (qada.date == today) qada.completedToday else 0,
            )
        }
    }

    private val snapshot: Snapshot? by lazy { WidgetSnapshot.load(context) }

    private fun today(): Int {
        val zone = snapshot?.config?.timezone?.takeIf { it.isNotEmpty() }?.let { TimeZone.getTimeZone(it) }
            ?: TimeZone.getDefault()
        return WidgetSnapshot.dateIntFor(System.currentTimeMillis(), zone)
    }

    fun getQadaSummary(): QadaSummary = summaryFrom(snapshot?.qada, today())

    fun getRemainingCount(): Int = getQadaSummary().totalMissed

    fun getCompletedCount(): Int = getQadaSummary().totalCompleted

    fun hasQadaData(): Boolean = getQadaSummary().hasData
}
