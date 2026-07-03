package dev.nedaa.android.widgets.ramadan

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.LocalContext
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
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
import dev.nedaa.android.widgets.common.NedaaWidgetTheme
import dev.nedaa.android.widgets.common.WidgetBoundaries
import dev.nedaa.android.widgets.common.WidgetConfig
import dev.nedaa.android.widgets.common.WidgetSizes
import dev.nedaa.android.widgets.data.PrayerData
import dev.nedaa.android.widgets.data.PrayerDataService
import dev.nedaa.android.widgets.importantdays.ImportantDay
import dev.nedaa.android.widgets.importantdays.ImportantDaysDataService
import java.util.TimeZone
import java.util.concurrent.TimeUnit

/**
 * Suhoor/Iftar countdown during Ramadan; falls back to the Ramadan countdown card off-season.
 * 2x2, resizable to 4x2.
 */
class SuhoorIftarWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.COMPACT, WidgetSizes.MEDIUM))

    companion object {
        /**
         * We are inside Ramadan when Eid al-Fitr's countdown is smaller than Ramadan's —
         * Ramadan already started so its next occurrence rolled to next year, making Eid the
         * sooner of the two. False if either row is missing.
         */
        fun isRamadan(days: List<ImportantDay>): Boolean {
            val ramadan = days.firstOrNull { it.id == "ramadan" } ?: return false
            val eidAlFitr = days.firstOrNull { it.id == "eid-al-fitr" } ?: return false
            return ImportantDaysDataService.daysUntil(eidAlFitr.dateISO) <
                ImportantDaysDataService.daysUntil(ramadan.dateISO)
        }
    }

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val days = ImportantDaysDataService(context).getUpcoming(10)
        val ramadanDay = days.firstOrNull { it.id == "ramadan" }
        val inRamadan = isRamadan(days)
        val todaysPrayers = if (inRamadan) PrayerDataService(context).getTodaysPrayerTimes() else null
        val fajr = todaysPrayers?.prayers?.firstOrNull { it.name == PrayerData.FAJR }
        val maghrib = todaysPrayers?.prayers?.firstOrNull { it.name == PrayerData.MAGHRIB }
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
                        inRamadan && fajr != null && maghrib != null ->
                            SuhoorIftarContent(fajr, maghrib, wide = size.width >= WidgetSizes.MEDIUM.width, config = config)
                        ramadanDay != null -> RamadanCountdown(context, ramadanDay, config)
                        else -> EmptyState(context)
                    }
                }
            }
        }
    }
}

private fun launchIntent(context: Context): Intent =
    context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()

@Composable
private fun SuhoorIftarContent(fajr: PrayerData, maghrib: PrayerData, wide: Boolean, config: WidgetConfig) {
    val context = LocalContext.current
    val suhoor = context.getString(R.string.widget_suhoor)
    val iftar = context.getString(R.string.widget_iftar)
    val now = System.currentTimeMillis()
    // Suhoor (Fajr) is the upcoming one until it passes; Iftar (Maghrib) is emphasized after.
    val suhoorNext = now < fajr.time.time
    if (wide) {
        Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            MealBlock(
                label = suhoor,
                time = config.localizeNumber(fajr.formatTime12Hour(locale = config.locale)),
                emphasized = suhoorNext,
                modifier = GlanceModifier.defaultWeight()
            )
            MealBlock(
                label = iftar,
                time = config.localizeNumber(maghrib.formatTime12Hour(locale = config.locale)),
                emphasized = !suhoorNext,
                modifier = GlanceModifier.defaultWeight()
            )
        }
    } else {
        Column(modifier = GlanceModifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
            MealBlock(
                label = if (suhoorNext) suhoor else iftar,
                time = config.localizeNumber(
                    if (suhoorNext) fajr.formatTime12Hour(locale = config.locale) else maghrib.formatTime12Hour(locale = config.locale)
                ),
                emphasized = true,
                modifier = GlanceModifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun MealBlock(label: String, time: String, emphasized: Boolean, modifier: GlanceModifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = label,
            style = TextStyle(
                color = if (emphasized) GlanceTheme.colors.primary else GlanceTheme.colors.onSurfaceVariant,
                fontSize = if (emphasized) 15.sp else 12.sp,
                fontWeight = FontWeight.Medium
            ),
            maxLines = 1
        )
        Spacer(modifier = GlanceModifier.height(4.dp))
        Text(
            text = time,
            style = TextStyle(
                color = if (emphasized) GlanceTheme.colors.primary else GlanceTheme.colors.onBackground,
                fontSize = if (emphasized) 26.sp else 16.sp,
                fontWeight = FontWeight.Bold
            ),
            maxLines = 1
        )
    }
}

@Composable
private fun RamadanCountdown(context: Context, ramadanDay: ImportantDay, config: WidgetConfig) {
    val remaining = ImportantDaysDataService.daysUntil(ramadanDay.dateISO)
    Column(
        modifier = GlanceModifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = ramadanDay.name,
            style = TextStyle(
                color = GlanceTheme.colors.onBackground,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            ),
            maxLines = 1
        )
        Spacer(modifier = GlanceModifier.height(2.dp))
        Text(
            text = ramadanDay.hijriLabel,
            style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant, fontSize = 10.sp),
            maxLines = 1
        )
        Spacer(modifier = GlanceModifier.height(8.dp))
        if (remaining == 0) {
            Text(
                text = context.getString(R.string.widget_days_today),
                style = TextStyle(color = GlanceTheme.colors.primary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            )
        } else {
            Text(
                text = config.localizeNumber(remaining),
                style = TextStyle(color = GlanceTheme.colors.primary, fontSize = 28.sp, fontWeight = FontWeight.Bold)
            )
            Text(
                text = context.getString(R.string.widget_days_unit),
                style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant, fontSize = 11.sp)
            )
        }
    }
}

@Composable
private fun EmptyState(context: Context) {
    Column(
        modifier = GlanceModifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = context.getString(R.string.widget_suhoor_iftar_name),
            style = TextStyle(color = GlanceTheme.colors.onBackground, fontSize = 14.sp, fontWeight = FontWeight.Medium)
        )
        Spacer(modifier = GlanceModifier.height(4.dp))
        Text(
            text = context.getString(R.string.widget_open_app),
            style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant, fontSize = 11.sp)
        )
    }
}

class SuhoorIftarReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = SuhoorIftarWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        SuhoorIftarWorker.scheduleUpdate(context, 0)
    }
}

class SuhoorIftarWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "SuhoorIftarWorker"
        private const val WORK_NAME = "suhoor_iftar_widget_update"

        fun scheduleUpdate(context: Context, delayMillis: Long = 0) {
            val workRequest = OneTimeWorkRequestBuilder<SuhoorIftarWorker>()
                .setInitialDelay(delayMillis, TimeUnit.MILLISECONDS)
                .build()

            WorkManager.getInstance(context)
                .enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.REPLACE, workRequest)

            Log.d(TAG, "Scheduled widget update in ${delayMillis / 1000}s (${delayMillis / 60000}min)")
        }
    }

    override suspend fun doWork(): Result {
        return try {
            SuhoorIftarWidget().updateAll(context)
            val now = System.currentTimeMillis()
            val todaysPrayers = PrayerDataService(context).getTodaysPrayerTimes()
            val nextFajr = todaysPrayers?.prayers?.firstOrNull { it.name == PrayerData.FAJR }?.time?.time
            val nextMaghrib = todaysPrayers?.prayers?.firstOrNull { it.name == PrayerData.MAGHRIB }?.time?.time
            val nextMidnight = WidgetBoundaries.nextMidnight(now, TimeZone.getDefault())
            val next = WidgetBoundaries.nextBoundary(now, listOf(nextFajr, nextMaghrib, nextMidnight))
            scheduleUpdate(context, next - now)
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Error updating widget", e)
            Result.retry()
        }
    }
}
