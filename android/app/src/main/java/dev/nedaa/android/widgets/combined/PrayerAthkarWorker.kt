package dev.nedaa.android.widgets.combined

import android.content.Context
import android.util.Log
import androidx.glance.appwidget.updateAll
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dev.nedaa.android.widgets.data.PrayerDataService
import java.util.concurrent.TimeUnit

/**
 * Background worker for updating Combined Prayer + Athkar widget
 *
 * Update strategy:
 * - Schedule update at exact next prayer time
 * - If next prayer is less than 15 min away, schedule 15 min after that prayer
 * - This ensures widget updates exactly when prayer changes
 */
class PrayerAthkarWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "PrayerAthkarWorker"
        private const val WORK_NAME = "prayer_athkar_widget_update"

        private const val FIFTEEN_MINUTES = 15 * 60 * 1000L
        private const val ONE_MINUTE = 60 * 1000L

        fun scheduleUpdate(context: Context, delayMillis: Long = 0) {
            val workRequest = OneTimeWorkRequestBuilder<PrayerAthkarWorker>()
                .setInitialDelay(delayMillis, TimeUnit.MILLISECONDS)
                .build()

            WorkManager.getInstance(context)
                .enqueueUniqueWork(
                    WORK_NAME,
                    ExistingWorkPolicy.REPLACE,
                    workRequest
                )

            Log.d(TAG, "Scheduled widget update in ${delayMillis / 1000}s (${delayMillis / 60000}min)")
        }

        fun cancelUpdates(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }

    override suspend fun doWork(): Result {
        return try {
            Log.d(TAG, "Updating Combined Prayer + Athkar widget")
            PrayerAthkarWidget().updateAll(context)
            scheduleNextUpdate()
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Error updating widget", e)
            Result.retry()
        }
    }

    private fun scheduleNextUpdate() {
        val prayerService = PrayerDataService(context)
        val nextPrayer = prayerService.getNextPrayer(true)

        val currentTime = System.currentTimeMillis()
        val nextPrayerTime = nextPrayer?.time?.time ?: (currentTime + FIFTEEN_MINUTES)

        val timeToNext = nextPrayerTime - currentTime

        val nextUpdateTime = if (timeToNext < FIFTEEN_MINUTES) {
            // Next prayer is less than 15 min away, schedule 15 min after it
            Log.d(TAG, "Next prayer < 15min away, scheduling 15min after prayer time")
            nextPrayerTime + FIFTEEN_MINUTES
        } else {
            // Schedule at exact prayer time
            Log.d(TAG, "Scheduling at exact next prayer time")
            nextPrayerTime
        }

        val delay = (nextUpdateTime - currentTime).coerceAtLeast(ONE_MINUTE)
        scheduleUpdate(context, delay)
    }
}
