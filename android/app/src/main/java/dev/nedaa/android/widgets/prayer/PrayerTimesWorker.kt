package dev.nedaa.android.widgets.prayer

import android.content.Context
import android.util.Log
import androidx.glance.appwidget.updateAll
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dev.nedaa.android.widgets.common.WidgetBoundaries
import dev.nedaa.android.widgets.data.PrayerDataService
import java.util.concurrent.TimeUnit

/**
 * Background worker for updating Prayer Times widget using WorkManager
 *
 * Update strategy:
 * - Schedule update at exact next prayer time
 * - If next prayer is less than 15 min away, schedule 15 min after that prayer
 * - This ensures widget updates exactly when prayer changes
 */
class PrayerTimesWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "PrayerTimesWorker"
        private const val WORK_NAME = "prayer_times_widget_update"

        private const val FIFTEEN_MINUTES = 15 * 60 * 1000L

        /**
         * Schedule widget update with optional delay
         */
        fun scheduleUpdate(context: Context, delayMillis: Long = 0) {
            val workRequest = OneTimeWorkRequestBuilder<PrayerTimesWorker>()
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

        /**
         * Cancel widget updates
         */
        fun cancelUpdates(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            Log.d(TAG, "Canceled widget updates")
        }
    }

    override suspend fun doWork(): Result {
        return try {
            Log.d(TAG, "Updating Prayer Times widgets")

            // Update all widget sizes
            PrayerTimesWidgetSmall().updateAll(context)
            PrayerTimesWidgetMedium().updateAll(context)
            PrayerTimesWidgetLarge().updateAll(context)

            // Schedule next update
            scheduleNextUpdate()

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Error updating widget", e)
            Result.retry()
        }
    }

    private fun scheduleNextUpdate() {
        val prayerService = PrayerDataService(context)
        val nextPrayerTime = prayerService.getNextPrayer(true)?.time?.time
        val now = System.currentTimeMillis()
        // A prayer already within 15 min updates 15 min AFTER the prayer instead,
        // so the widget settles on the new current prayer.
        val candidate = if (nextPrayerTime != null && nextPrayerTime - now < FIFTEEN_MINUTES) {
            nextPrayerTime + FIFTEEN_MINUTES
        } else {
            nextPrayerTime
        }
        val delay = WidgetBoundaries.nextBoundary(now, listOf(candidate)) - now
        scheduleUpdate(context, delay)
    }
}
