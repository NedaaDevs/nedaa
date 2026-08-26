package dev.nedaa.android.widgets.data

import android.content.Context
import android.util.Log
import dev.nedaa.android.widgets.common.DatabaseProvider
import dev.nedaa.android.widgets.common.DayWindow
import java.util.TimeZone

/**
 * Service for fetching Qada (missed fasts) data from the SQLite database
 */
class QadaDataService(private val context: Context) {

    companion object {
        private const val TAG = "QadaDataService"
        private const val QADA_FASTS_TABLE = "qada_fasts"
        private const val QADA_HISTORY_TABLE = "qada_history"
    }

    /**
     * Get the Qada summary (totals and today's completions)
     */
    fun getQadaSummary(): QadaSummary {
        val totals = getQadaTotals()
        val todayCompleted = getTodayCompletedCount()

        return QadaSummary(
            totalMissed = totals.first,
            totalCompleted = totals.second,
            todayCompleted = todayCompleted
        )
    }

    /**
     * Get total missed and completed fasts
     */
    private fun getQadaTotals(): Pair<Int, Int> {
        return try {
            DatabaseProvider.getNedaaDatabase(context)?.use { db ->
                val cursor = db.rawQuery(
                    // Every write targets `id = 1` and the schema does not constrain the
                    // table to one row, so name the row rather than taking the first.
                    "SELECT total_missed, total_completed FROM $QADA_FASTS_TABLE WHERE id = 1",
                    null
                )

                cursor.use {
                    if (it.moveToFirst()) {
                        val totalMissed = it.getInt(0)
                        val totalCompleted = it.getInt(1)
                        Pair(totalMissed, totalCompleted)
                    } else {
                        Pair(0, 0)
                    }
                }
            } ?: Pair(0, 0)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting Qada totals", e)
            Pair(0, 0)
        }
    }

    /**
     * Get the count of fasts completed today
     */
    private fun getTodayCompletedCount(): Int {
        return try {
            DatabaseProvider.getNedaaDatabase(context)?.use { db ->
                val (todayStart, todayEnd) =
                    DayWindow.todayUtcBounds(TimeZone.getDefault(), System.currentTimeMillis())

                // Sum the days, not the rows: completing a multi-day entry writes one
                // ledger row carrying its whole count.
                val cursor = db.rawQuery(
                    """SELECT COALESCE(SUM(count), 0) FROM $QADA_HISTORY_TABLE
                       WHERE type = 'completed'
                       AND updated_at >= ?
                       AND updated_at < ?""",
                    arrayOf(todayStart, todayEnd)
                )

                cursor.use {
                    if (it.moveToFirst()) it.getInt(0) else 0
                }
            } ?: 0
        } catch (e: Exception) {
            Log.e(TAG, "Error getting today's completed count", e)
            0
        }
    }

    /**
     * Get the remaining number of fasts to make up
     */
    fun getRemainingCount(): Int {
        return getQadaTotals().first
    }

    /**
     * Get the completed fasts count
     */
    fun getCompletedCount(): Int {
        return getQadaTotals().second
    }

    /**
     * Check if there is any Qada data
     */
    fun hasQadaData(): Boolean {
        val totals = getQadaTotals()
        return totals.first > 0 || totals.second > 0
    }

}
