package dev.nedaa.android.widgets.data

import android.content.Context
import android.util.Log
import dev.nedaa.android.widgets.common.DatabaseProvider
import java.util.Calendar
import java.util.TimeZone

/**
 * Service for fetching Athkar (remembrance) data from the SQLite database
 */
class AthkarDataService(private val context: Context) {

    companion object {
        private const val TAG = "AthkarDataService"
        private const val STREAK_TABLE = "athkar_streak"
        private const val COMPLETED_DAYS_TABLE = "athkar_completed_days"
        private const val DAILY_ITEMS_TABLE = "athkar_daily_items"
    }

    /**
     * Get today's Athkar summary including completion status and streaks
     */
    fun getAthkarSummary(): AthkarSummary {
        val todayInt = getTodayDateInt()

        val completion = getTodayCompletion(todayInt)
        val streak = getStreakData()
        val progress = getTodayProgress(todayInt)

        return AthkarSummary(
            morningCompleted = completion.first,
            eveningCompleted = completion.second,
            currentStreak = streak.first,
            longestStreak = streak.second,
            completedItems = progress.first,
            totalItems = progress.second
        )
    }

    /**
     * Get today's morning/evening completion status
     */
    private fun getTodayCompletion(todayInt: Int): Pair<Boolean, Boolean> {
        return try {
            DatabaseProvider.getAthkarDatabase(context)?.use { db ->
                val cursor = db.rawQuery(
                    """SELECT morning_completed_at, evening_completed_at
                       FROM $COMPLETED_DAYS_TABLE
                       WHERE date = ?""",
                    arrayOf(todayInt.toString())
                )

                cursor.use {
                    if (it.moveToFirst()) {
                        val morningCompleted = !it.isNull(0)
                        val eveningCompleted = !it.isNull(1)
                        Pair(morningCompleted, eveningCompleted)
                    } else {
                        Pair(false, false)
                    }
                }
            } ?: Pair(false, false)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting today's completion", e)
            Pair(false, false)
        }
    }

    /**
     * Get current and longest streak
     */
    private fun getStreakData(): Pair<Int, Int> {
        return try {
            DatabaseProvider.getAthkarDatabase(context)?.use { db ->
                val cursor = db.rawQuery(
                    "SELECT current_streak, longest_streak FROM $STREAK_TABLE WHERE id = 1",
                    null
                )

                cursor.use {
                    if (it.moveToFirst()) {
                        val currentStreak = it.getInt(0)
                        val longestStreak = it.getInt(1)
                        Pair(currentStreak, longestStreak)
                    } else {
                        Pair(0, 0)
                    }
                }
            } ?: Pair(0, 0)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting streak data", e)
            Pair(0, 0)
        }
    }

    /**
     * Get today's progress (completed items vs total items)
     */
    private fun getTodayProgress(todayInt: Int): Pair<Int, Int> {
        return try {
            DatabaseProvider.getAthkarDatabase(context)?.use { db ->
                val cursor = db.rawQuery(
                    """SELECT
                         SUM(CASE WHEN current_count >= total_count THEN 1 ELSE 0 END) as completed,
                         COUNT(*) as total
                       FROM $DAILY_ITEMS_TABLE
                       WHERE date = ?""",
                    arrayOf(todayInt.toString())
                )

                cursor.use {
                    if (it.moveToFirst()) {
                        val completed = it.getInt(0)
                        val total = it.getInt(1)
                        Pair(completed, total)
                    } else {
                        Pair(0, 0)
                    }
                }
            } ?: Pair(0, 0)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting today's progress", e)
            Pair(0, 0)
        }
    }

    /**
     * Check if morning session is completed
     */
    fun isMorningCompleted(): Boolean {
        val todayInt = getTodayDateInt()
        return getTodayCompletion(todayInt).first
    }

    /**
     * Check if evening session is completed
     */
    fun isEveningCompleted(): Boolean {
        val todayInt = getTodayDateInt()
        return getTodayCompletion(todayInt).second
    }

    /**
     * Get today's date as YYYYMMDD integer
     */
    private fun getTodayDateInt(): Int {
        val calendar = Calendar.getInstance(TimeZone.getDefault())
        val year = calendar.get(Calendar.YEAR)
        val month = calendar.get(Calendar.MONTH) + 1
        val day = calendar.get(Calendar.DAY_OF_MONTH)
        return year * 10000 + month * 100 + day
    }
}
