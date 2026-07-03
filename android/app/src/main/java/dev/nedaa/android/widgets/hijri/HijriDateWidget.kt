package dev.nedaa.android.widgets.hijri

// Registration (manifest receiver entry, "hijri_date" pin key, settings entry,
// widget_hijri_date_name string) is owned by the controller task, not this file.

import android.content.Context
import android.content.Intent
import android.icu.text.DateFormat
import android.icu.util.IslamicCalendar
import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
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
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import dev.nedaa.android.widgets.common.DatabaseProvider
import dev.nedaa.android.widgets.common.NedaaWidgetTheme
import dev.nedaa.android.widgets.common.WidgetBoundaries
import dev.nedaa.android.widgets.common.WidgetConfig
import dev.nedaa.android.widgets.common.WidgetSizes
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

/** Reads the single-row `widget_hijri_today` table Task 5 populates in nedaa.db. */
class HijriTodayService(private val context: Context) {

    companion object {
        private const val TAG = "HijriTodayService"
        private const val TABLE_NAME = "widget_hijri_today"
    }

    fun get(): String? {
        return try {
            DatabaseProvider.getNedaaDatabase(context)?.use { db ->
                val cursor = db.rawQuery("SELECT hijriLabel FROM $TABLE_NAME LIMIT 1", null)
                cursor.use {
                    if (it.moveToFirst()) it.getString(0) else null
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching hijri today", e)
            null
        }
    }
}

/**
 * Umm al-Qura Hijri date, computed on-device.
 *
 * This is the ONE sanctioned Kotlin Hijri computation in the widget code — only used
 * when the app hasn't written `widget_hijri_today` yet (e.g. first install before the
 * next background refresh). Must stay Umm al-Qura to match the app's hijri-native source.
 */
private fun computeHijriLabelFallback(locale: Locale): String {
    val calendar = IslamicCalendar().apply {
        calculationType = IslamicCalendar.CalculationType.ISLAMIC_UMALQURA
    }
    val day = calendar.get(IslamicCalendar.DAY_OF_MONTH)
    val year = calendar.get(IslamicCalendar.YEAR)
    val monthName = DateFormat.getPatternInstance(calendar, "MMMM", locale)
        .format(calendar.time)
    return "$day $monthName $year"
}

/** Today's Hijri date at a glance (1x1, resizable to 2x1). */
class HijriDateWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.COMPACT))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val config = WidgetConfig.get(context)
        // hijriLabel from the DB is a JS-computed payload already localized to the app's
        // locale/numerals; the on-device fallback is the only Kotlin-computed case that
        // needs config applied here.
        val hijriLabel = HijriTodayService(context).get()
            ?: config.localizeNumber(computeHijriLabelFallback(config.locale))
        val gregorianLabel = config.localizeNumber(
            SimpleDateFormat("d MMM yyyy", config.locale).format(Date())
        )
        provideContent {
            NedaaWidgetTheme {
                Box(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .background(GlanceTheme.colors.background)
                        .cornerRadius(16.dp)
                        .clickable(actionStartActivity(launchIntent(context)))
                        .padding(8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    HijriDateContent(hijriLabel, gregorianLabel)
                }
            }
        }
    }
}

private fun launchIntent(context: Context): Intent =
    context.packageManager.getLaunchIntentForPackage(context.packageName) ?: Intent()

@Composable
private fun HijriDateContent(hijriLabel: String, gregorianLabel: String) {
    Column(
        modifier = GlanceModifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = hijriLabel,
            style = TextStyle(
                color = GlanceTheme.colors.onBackground,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold
            ),
            maxLines = 2
        )
        Text(
            text = gregorianLabel,
            style = TextStyle(
                color = GlanceTheme.colors.onSurfaceVariant,
                fontSize = 11.sp
            ),
            maxLines = 1
        )
    }
}

class HijriDateReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = HijriDateWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        HijriDateWorker.scheduleUpdate(context, 0)
    }
}

class HijriDateWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "HijriDateWorker"
        private const val WORK_NAME = "hijri_date_widget_update"

        fun scheduleUpdate(context: Context, delayMillis: Long = 0) {
            val workRequest = OneTimeWorkRequestBuilder<HijriDateWorker>()
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
            HijriDateWidget().updateAll(context)
            val now = System.currentTimeMillis()
            scheduleUpdate(context, WidgetBoundaries.nextMidnight(now, TimeZone.getDefault()) - now)
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Error updating widget", e)
            Result.retry()
        }
    }
}
