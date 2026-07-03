package dev.nedaa.android.widgets.athkar

import android.content.Context
import android.util.Log
import androidx.glance.appwidget.updateAll
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dev.nedaa.android.widgets.common.WidgetBoundaries
import dev.nedaa.android.widgets.data.PrayerData
import dev.nedaa.android.widgets.data.PrayerDataService
import java.util.Calendar
import java.util.TimeZone
import java.util.concurrent.TimeUnit

/**
 * Background worker for updating Athkar Progress widget
 * Schedules daily updates at midnight
 */
class AthkarWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "AthkarWorker"
        private const val WORK_NAME = "athkar_widget_update"

        /**
         * Schedule periodic updates at midnight
         */
        fun schedulePeriodicUpdate(context: Context) {
            val delayUntilMidnight = calculateDelayUntilMidnight()

            val workRequest = PeriodicWorkRequestBuilder<AthkarWorker>(24, TimeUnit.HOURS)
                .setInitialDelay(delayUntilMidnight, TimeUnit.MILLISECONDS)
                .build()

            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.UPDATE,
                    workRequest
                )

            Log.d(TAG, "Scheduled daily athkar widget update")
        }

        /**
         * One-time update that re-chains to the next boundary. The promoted
         * athkar session flips at Dhuhr and Asr, so those (plus midnight) are
         * the boundaries that must re-render the widget.
         */
        fun scheduleUpdate(context: Context, delayMillis: Long = 0) {
            val workRequest = OneTimeWorkRequestBuilder<AthkarWorker>()
                .setInitialDelay(delayMillis, TimeUnit.MILLISECONDS)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.REPLACE, workRequest)
        }

        /**
         * Cancel periodic updates
         */
        fun cancelUpdates(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }

        /**
         * Calculate milliseconds until next midnight
         */
        private fun calculateDelayUntilMidnight(): Long {
            val now = Calendar.getInstance()
            val midnight = Calendar.getInstance().apply {
                add(Calendar.DAY_OF_YEAR, 1)
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            return midnight.timeInMillis - now.timeInMillis
        }
    }

    override suspend fun doWork(): Result {
        return try {
            Log.d(TAG, "Updating Athkar widgets")
            AthkarWidget().updateAll(context)
            AthkarWidgetMedium().updateAll(context)
            scheduleNextUpdate()
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Error updating widget", e)
            Result.retry()
        }
    }

    // Re-render at the next of Dhuhr / Asr / midnight so the promoted session
    // flips on time. Falls back to WidgetBoundaries' 15-min default if today's
    // prayer times are unavailable.
    private fun scheduleNextUpdate() {
        val now = System.currentTimeMillis()
        val prayers = PrayerDataService(context).getTodaysPrayerTimes()?.prayers
        val dhuhr = prayers?.firstOrNull {
            it.name == PrayerData.DHUHR || it.name == PrayerData.JUMUAH
        }?.time?.time
        val asr = prayers?.firstOrNull { it.name == PrayerData.ASR }?.time?.time
        val midnight = WidgetBoundaries.nextMidnight(now, TimeZone.getDefault())
        val delay = WidgetBoundaries.nextBoundary(now, listOf(dhuhr, asr, midnight)) - now
        scheduleUpdate(context, delay)
    }
}
