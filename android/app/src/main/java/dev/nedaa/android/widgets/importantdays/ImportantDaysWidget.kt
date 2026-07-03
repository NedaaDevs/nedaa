package dev.nedaa.android.widgets.importantdays

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dev.nedaa.android.R
import dev.nedaa.android.widgets.common.DatabaseProvider
import dev.nedaa.android.widgets.common.NedaaColors
import dev.nedaa.android.widgets.common.NedaaWidgetTheme
import dev.nedaa.android.widgets.common.WidgetBoundaries
import dev.nedaa.android.widgets.common.WidgetConfig
import dev.nedaa.android.widgets.common.WidgetSizes
import java.util.Calendar
import java.util.TimeZone
import java.util.concurrent.TimeUnit

data class ImportantDay(val id: String, val name: String, val hijriLabel: String, val dateISO: String)

/** Reads the `widget_important_days` table Task 5 populates in nedaa.db. */
class ImportantDaysDataService(private val context: Context) {

    companion object {
        private const val TAG = "ImportantDaysDataService"
        private const val TABLE_NAME = "widget_important_days"

        /** Whole days from today (device zone) to the ISO date; never negative. */
        fun daysUntil(dateISO: String, now: Long = System.currentTimeMillis()): Int {
            val parts = dateISO.split("-").map { it.toInt() }
            val target = Calendar.getInstance().apply {
                set(parts[0], parts[1] - 1, parts[2], 0, 0, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val today = Calendar.getInstance().apply {
                timeInMillis = now
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            return (((target.timeInMillis - today.timeInMillis) / 86_400_000L).toInt()).coerceAtLeast(0)
        }
    }

    fun getUpcoming(limit: Int): List<ImportantDay> {
        return try {
            DatabaseProvider.getNedaaDatabase(context)?.use { db ->
                val cursor = db.rawQuery(
                    "SELECT id, name, hijriLabel, dateISO FROM $TABLE_NAME ORDER BY sort LIMIT ?",
                    arrayOf(limit.toString())
                )
                cursor.use {
                    val days = mutableListOf<ImportantDay>()
                    while (it.moveToNext()) {
                        days.add(ImportantDay(it.getString(0), it.getString(1), it.getString(2), it.getString(3)))
                    }
                    days
                }
            } ?: emptyList()
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching important days", e)
            emptyList()
        }
    }
}

/** Countdowns to Ramadan, Eid, and other important Hijri dates (2x2, resizable to 4x2). */
class ImportantDaysWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.COMPACT, WidgetSizes.MEDIUM))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val days = ImportantDaysDataService(context).getUpcoming(3)
        val config = WidgetConfig.get(context)
        provideContent {
            NedaaWidgetTheme {
                val size = LocalSize.current
                Box(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .background(GlanceTheme.colors.background)
                        .cornerRadius(16.dp)
                        .clickable(actionStartActivity(launchIntent(context)))
                        .padding(12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    when {
                        days.isEmpty() -> EmptyState(context)
                        size.width >= WidgetSizes.MEDIUM.width -> WideContent(context, config, days)
                        else -> CompactContent(context, config, days.first())
                    }
                }
            }
        }
    }
}

private fun launchIntent(context: Context): Intent =
    context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()

@Composable
private fun CompactContent(context: Context, config: WidgetConfig, day: ImportantDay) {
    val remaining = ImportantDaysDataService.daysUntil(day.dateISO)
    Column(
        modifier = GlanceModifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = day.name,
            style = TextStyle(
                color = GlanceTheme.colors.onBackground,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            ),
            maxLines = 1
        )
        Spacer(modifier = GlanceModifier.height(2.dp))
        Text(
            text = day.hijriLabel,
            style = TextStyle(
                color = GlanceTheme.colors.onSurfaceVariant,
                fontSize = 10.sp
            ),
            maxLines = 1
        )
        Spacer(modifier = GlanceModifier.height(8.dp))
        if (remaining == 0) {
            Text(
                text = context.getString(R.string.widget_days_today),
                style = TextStyle(
                    color = GlanceTheme.colors.primary,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold
                )
            )
        } else {
            Text(
                text = config.localizeNumber(remaining),
                style = TextStyle(
                    color = GlanceTheme.colors.primary,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold
                )
            )
            Text(
                text = context.getString(R.string.widget_days_unit),
                style = TextStyle(
                    color = GlanceTheme.colors.onSurfaceVariant,
                    fontSize = 11.sp
                )
            )
        }
    }
}

@Composable
private fun WideContent(context: Context, config: WidgetConfig, days: List<ImportantDay>) {
    Column(modifier = GlanceModifier.fillMaxSize()) {
        Row(
            modifier = GlanceModifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = GlanceModifier.defaultWeight()) {
                Text(
                    text = days.first().name,
                    style = TextStyle(
                        color = GlanceTheme.colors.onBackground,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    ),
                    maxLines = 1
                )
                Text(
                    text = days.first().hijriLabel,
                    style = TextStyle(
                        color = GlanceTheme.colors.onSurfaceVariant,
                        fontSize = 11.sp
                    ),
                    maxLines = 1
                )
            }
            DaysPill(context, config, ImportantDaysDataService.daysUntil(days.first().dateISO), prominent = true)
        }

        if (days.size > 1) {
            Spacer(modifier = GlanceModifier.height(8.dp))
            Box(
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(NedaaColors.GlanceColors.divider)
            ) {}
            Spacer(modifier = GlanceModifier.height(8.dp))

            days.drop(1).forEachIndexed { index, day ->
                Row(
                    modifier = GlanceModifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = day.name,
                        style = TextStyle(
                            color = GlanceTheme.colors.onBackground,
                            fontSize = 13.sp
                        ),
                        maxLines = 1,
                        modifier = GlanceModifier.defaultWeight()
                    )
                    DaysPill(context, config, ImportantDaysDataService.daysUntil(day.dateISO), prominent = false)
                }
                if (index < days.size - 2) {
                    Spacer(modifier = GlanceModifier.height(4.dp))
                }
            }
        }
    }
}

@Composable
private fun DaysPill(context: Context, config: WidgetConfig, remaining: Int, prominent: Boolean) {
    val text = if (remaining == 0) {
        context.getString(R.string.widget_days_today)
    } else {
        "${config.localizeNumber(remaining)} ${context.getString(R.string.widget_days_unit)}"
    }
    Text(
        text = text,
        style = TextStyle(
            color = GlanceTheme.colors.primary,
            fontSize = if (prominent) 20.sp else 13.sp,
            fontWeight = FontWeight.Bold
        )
    )
}

@Composable
private fun EmptyState(context: Context) {
    Column(
        modifier = GlanceModifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = context.getString(R.string.widget_important_days_name),
            style = TextStyle(
                color = GlanceTheme.colors.onBackground,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium
            )
        )
        Spacer(modifier = GlanceModifier.height(4.dp))
        Text(
            text = context.getString(R.string.widget_open_app),
            style = TextStyle(
                color = GlanceTheme.colors.onSurfaceVariant,
                fontSize = 11.sp
            )
        )
    }
}

class ImportantDaysReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = ImportantDaysWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        ImportantDaysWorker.scheduleUpdate(context, 0)
    }
}

class ImportantDaysWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "ImportantDaysWorker"
        private const val WORK_NAME = "important_days_widget_update"

        fun scheduleUpdate(context: Context, delayMillis: Long = 0) {
            val workRequest = OneTimeWorkRequestBuilder<ImportantDaysWorker>()
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
    }

    override suspend fun doWork(): Result {
        return try {
            ImportantDaysWidget().updateAll(context)
            val now = System.currentTimeMillis()
            scheduleUpdate(context, WidgetBoundaries.nextMidnight(now, TimeZone.getDefault()) - now)
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Error updating widget", e)
            Result.retry()
        }
    }
}
