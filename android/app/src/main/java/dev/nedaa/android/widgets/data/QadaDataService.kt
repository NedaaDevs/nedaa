package dev.nedaa.android.widgets.data

import android.content.Context
import android.util.Log
import dev.nedaa.android.widgets.common.DatabaseProvider
import java.util.Calendar
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
                    "SELECT total_missed, total_completed FROM $QADA_FASTS_TABLE LIMIT 1",
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
                // Get today's date range for the query
                val todayStart = getTodayStartIso()
                val todayEnd = getTodayEndIso()

                val cursor = db.rawQuery(
                    """SELECT COUNT(*) FROM $QADA_HISTORY_TABLE
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

    /**
     * Get today's start time in ISO format
     */
    private fun getTodayStartIso(): String {
        val calendar = Calendar.getInstance(TimeZone.getDefault()).apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        return toIsoString(calendar)
    }

    /**
     * Get tomorrow's start time in ISO format (end of today)
     */
    private fun getTodayEndIso(): String {
        val calendar = Calendar.getInstance(TimeZone.getDefault()).apply {
            add(Calendar.DAY_OF_YEAR, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        return toIsoString(calendar)
    }

    /**
     * Convert Calendar to ISO 8601 string
     */
    private fun toIsoString(calendar: Calendar): String {
        val year = calendar.get(Calendar.YEAR)
        val month = calendar.get(Calendar.MONTH) + 1
        val day = calendar.get(Calendar.DAY_OF_MONTH)
        val hour = calendar.get(Calendar.HOUR_OF_DAY)
        val minute = calendar.get(Calendar.MINUTE)
        val second = calendar.get(Calendar.SECOND)
        return String.format(
            "%04d-%02d-%02dT%02d:%02d:%02d.000Z",
            year, month, day, hour, minute, second
        )
    }
}
