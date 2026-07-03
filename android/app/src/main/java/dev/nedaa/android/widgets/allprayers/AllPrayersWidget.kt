package dev.nedaa.android.widgets.allprayers

// NOTE: this widget is not wired up yet. Registering it (AndroidManifest receiver entry,
// pin map key "all_prayers", settings/widgets.tsx entry, and the widget_all_prayers_name /
// widget_all_prayers_description strings) is done by the controller task, not here.

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
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
import dev.nedaa.android.widgets.common.WidgetSizes
import dev.nedaa.android.widgets.common.WidgetConfig
import dev.nedaa.android.widgets.common.DateUtils
import dev.nedaa.android.widgets.data.DayPrayers
import dev.nedaa.android.widgets.data.PrayerData
import dev.nedaa.android.widgets.data.PrayerDataService
import java.util.concurrent.TimeUnit

/** All five daily prayers in a single row (4x1, resizable up to 4x2 with a Hijri header + Sunrise). */
class AllPrayersWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.MEDIUM, WidgetSizes.WIDE))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val prayerService = PrayerDataService(context)
        val dayPrayers = prayerService.getTodaysPrayerTimes(showSunrise = true)
        val nextPrayer = prayerService.getNextPrayer(showSunrise = true)
        val previousPrayer = prayerService.getPreviousPrayer(showSunrise = true)
        val config = WidgetConfig.get(context)

        provideContent {
            NedaaWidgetTheme {
                val size = LocalSize.current
                val isMedium = size.height >= WidgetSizes.MEDIUM.height
                Box(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .background(GlanceTheme.colors.background)
                        .cornerRadius(16.dp)
                        .clickable(actionStartActivity(launchIntent(context)))
                        .padding(horizontal = 10.dp, vertical = if (isMedium) 10.dp else 6.dp),
                    contentAlignment = Alignment.Center
                ) {
                    if (dayPrayers == null || dayPrayers.prayers.isEmpty()) {
                        EmptyState(context)
                    } else {
                        AllPrayersContent(
                            context = context,
                            config = config,
                            dayPrayers = dayPrayers,
                            nextPrayer = nextPrayer,
                            previousPrayer = previousPrayer,
                            showSunrise = isMedium,
                            showHeader = isMedium
                        )
                    }
                }
            }
        }
    }
}

private fun launchIntent(context: Context): Intent =
    context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()

@Composable
private fun AllPrayersContent(
    context: Context,
    config: WidgetConfig,
    dayPrayers: DayPrayers,
    nextPrayer: PrayerData?,
    previousPrayer: PrayerData?,
    showSunrise: Boolean,
    showHeader: Boolean
) {
    val prayers = if (showSunrise) {
        dayPrayers.prayers
    } else {
        dayPrayers.prayers.filterNot { it.name == PrayerData.SUNRISE }
    }
    val timezone = dayPrayers.getTimezoneObj()

    val isCurrent = { p: PrayerData ->
        previousPrayer != null && p.name == previousPrayer.name && p.time == previousPrayer.time
    }
    val isNext = { p: PrayerData ->
        nextPrayer != null && p.name == nextPrayer.name && p.time == nextPrayer.time
    }

    Column(modifier = GlanceModifier.fillMaxSize()) {
        if (showHeader) {
            Text(
                text = config.localizeNumber(
                    DateUtils.getHijriDateStringCompact(dayPrayers.getDateAsDate(), timezone, config.locale)
                ),
                style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant, fontSize = 11.sp),
                maxLines = 1
            )
            Spacer(modifier = GlanceModifier.height(6.dp))
        }
        // With height (4×2+) each prayer is its own full-width row — far more
        // legible than cramming five name/time columns into a single 4×1 line,
        // which is only used at the minimum height.
        if (showHeader) {
            Column(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) {
                prayers.forEach { prayer ->
                    PrayerRow(
                        context = context,
                        config = config,
                        prayer = prayer,
                        timezone = timezone,
                        isCurrent = isCurrent(prayer),
                        isNext = isNext(prayer),
                        modifier = GlanceModifier.fillMaxWidth().defaultWeight()
                    )
                }
            }
        } else {
            Row(
                modifier = GlanceModifier.fillMaxWidth().defaultWeight(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                prayers.forEach { prayer ->
                    // defaultWeight() is a RowScope member, so build the modifier here.
                    PrayerColumn(
                        context = context,
                        config = config,
                        prayer = prayer,
                        timezone = timezone,
                        isCurrent = isCurrent(prayer),
                        isNext = isNext(prayer),
                        modifier = GlanceModifier.defaultWeight().fillMaxSize().padding(horizontal = 2.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun PrayerRow(
    context: Context,
    config: WidgetConfig,
    prayer: PrayerData,
    timezone: java.util.TimeZone,
    isCurrent: Boolean,
    isNext: Boolean,
    modifier: GlanceModifier
) {
    val nameColor = if (isCurrent) GlanceTheme.colors.onPrimary else GlanceTheme.colors.onBackground
    val timeColor = if (isCurrent) GlanceTheme.colors.onPrimary else GlanceTheme.colors.onSurfaceVariant

    Box(
        modifier = modifier.then(
            if (isCurrent) {
                GlanceModifier.background(GlanceTheme.colors.primary).cornerRadius(10.dp)
            } else {
                GlanceModifier
            }
        ),
        contentAlignment = Alignment.Center
    ) {
        Row(
            modifier = GlanceModifier.fillMaxWidth().padding(horizontal = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = shortPrayerName(prayer.name, context),
                style = TextStyle(color = nameColor, fontSize = 14.sp, fontWeight = FontWeight.Medium),
                maxLines = 1,
                modifier = GlanceModifier.defaultWeight()
            )
            Text(
                text = config.localizeNumber(prayer.formatTime12Hour(timezone, config.locale)),
                style = TextStyle(
                    color = timeColor,
                    fontSize = 14.sp,
                    fontWeight = if (isNext || isCurrent) FontWeight.Bold else FontWeight.Normal
                ),
                maxLines = 1
            )
        }
    }
}

@Composable
private fun PrayerColumn(
    context: Context,
    config: WidgetConfig,
    prayer: PrayerData,
    timezone: java.util.TimeZone,
    isCurrent: Boolean,
    isNext: Boolean,
    modifier: GlanceModifier
) {
    val nameColor = if (isCurrent) GlanceTheme.colors.onPrimary else GlanceTheme.colors.onBackground
    val timeColor = if (isCurrent) GlanceTheme.colors.onPrimary else GlanceTheme.colors.onSurfaceVariant

    Box(
        modifier = modifier.then(
            if (isCurrent) {
                GlanceModifier.background(GlanceTheme.colors.primary).cornerRadius(10.dp)
            } else {
                GlanceModifier
            }
        ),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = shortPrayerName(prayer.name, context),
                style = TextStyle(color = nameColor, fontSize = 11.sp, fontWeight = FontWeight.Medium),
                maxLines = 1
            )
            Spacer(modifier = GlanceModifier.height(2.dp))
            Text(
                text = config.localizeNumber(prayer.formatTime12Hour(timezone, config.locale)),
                style = TextStyle(
                    color = timeColor,
                    fontSize = 11.sp,
                    fontWeight = if (isNext) FontWeight.Bold else FontWeight.Normal
                ),
                maxLines = 1
            )
        }
    }
}

private fun shortPrayerName(name: String, context: Context): String {
    return when (name) {
        PrayerData.FAJR -> context.getString(R.string.prayer_fajr)
        PrayerData.SUNRISE -> context.getString(R.string.prayer_sunrise)
        PrayerData.DHUHR -> context.getString(R.string.prayer_dhuhr)
        PrayerData.JUMUAH -> context.getString(R.string.prayer_jumuah)
        PrayerData.ASR -> context.getString(R.string.prayer_asr)
        PrayerData.MAGHRIB -> context.getString(R.string.prayer_maghrib)
        PrayerData.ISHA -> context.getString(R.string.prayer_isha)
        else -> name.replaceFirstChar { it.uppercase() }
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
            text = context.getString(R.string.widget_prayer_times_title),
            style = TextStyle(
                color = GlanceTheme.colors.onBackground,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )
        )
        Spacer(modifier = GlanceModifier.height(2.dp))
        Text(
            text = context.getString(R.string.widget_open_app),
            style = TextStyle(
                color = GlanceTheme.colors.onSurfaceVariant,
                fontSize = 10.sp
            )
        )
    }
}

class AllPrayersReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = AllPrayersWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        AllPrayersWorker.scheduleUpdate(context, 0)
    }
}

class AllPrayersWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "AllPrayersWorker"
        private const val WORK_NAME = "all_prayers_widget_update"
        private const val FIFTEEN_MINUTES = 15 * 60 * 1000L

        fun scheduleUpdate(context: Context, delayMillis: Long = 0) {
            val workRequest = OneTimeWorkRequestBuilder<AllPrayersWorker>()
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
            AllPrayersWidget().updateAll(context)

            val prayerService = PrayerDataService(context)
            val nextPrayerTime = prayerService.getNextPrayer(showSunrise = true)?.time?.time
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

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Error updating widget", e)
            Result.retry()
        }
    }
}
