package dev.nedaa.android.widgets.athkar

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.fillMaxSize
import dev.nedaa.android.widgets.common.DatabaseProvider
import dev.nedaa.android.widgets.common.NedaaWidgetTheme
import dev.nedaa.android.widgets.common.WidgetConfig
import dev.nedaa.android.widgets.common.WidgetSizes
import dev.nedaa.android.widgets.data.AthkarDataService
import dev.nedaa.android.widgets.data.PrayerData
import dev.nedaa.android.widgets.data.PrayerDataService
import java.util.Calendar
import java.util.TimeZone

/**
 * Athkar Progress home screen widget (2x2), resizable up to the Medium (4x2) layout.
 * Shows morning/evening completion, streaks, and daily progress
 */
class AthkarWidget : GlanceAppWidget() {

    override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.COMPACT, WidgetSizes.MEDIUM))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val config = WidgetConfig.get(context)
        provideContent {
            val session = promotedAthkarSession(context)
            val (completed, total) = sessionAthkarProgress(context, session)
            val summary = AthkarDataService(context).getAthkarSummary()
                .copy(completedItems = completed, totalItems = total)

            NedaaWidgetTheme {
                ResponsiveAthkarContent(
                    summary = summary,
                    promotedSession = session,
                    config = config,
                    modifier = GlanceModifier.fillMaxSize()
                )
            }
        }
    }
}

/**
 * Which Athkar session to surface right now: morning before Dhuhr, evening after Asr,
 * and — between the two — whichever is still incomplete (evening if both are done).
 */
internal fun promotedAthkarSession(context: Context): String {
    val dayPrayers = PrayerDataService(context).getTodaysPrayerTimes(showSunrise = false)
    val dhuhr = dayPrayers?.prayers?.firstOrNull {
        it.name == PrayerData.DHUHR || it.name == PrayerData.JUMUAH
    }?.time
    val asr = dayPrayers?.prayers?.firstOrNull { it.name == PrayerData.ASR }?.time
    val now = System.currentTimeMillis()

    return when {
        dhuhr != null && now < dhuhr.time -> ATHKAR_SESSION_MORNING
        asr != null && now >= asr.time -> ATHKAR_SESSION_EVENING
        else -> {
            val summary = AthkarDataService(context).getAthkarSummary()
            when {
                !summary.morningCompleted -> ATHKAR_SESSION_MORNING
                else -> ATHKAR_SESSION_EVENING
            }
        }
    }
}

/** Completed/total items for a single Athkar session today (thikr_id suffix `-morning`/`-evening`). */
internal fun sessionAthkarProgress(context: Context, session: String): Pair<Int, Int> {
    return try {
        DatabaseProvider.getAthkarDatabase(context)?.use { db ->
            val cursor = db.rawQuery(
                """SELECT
                     SUM(CASE WHEN current_count >= total_count THEN 1 ELSE 0 END),
                     COUNT(*)
                   FROM athkar_daily_items
                   WHERE date = ? AND thikr_id LIKE ?""",
                arrayOf(todayAthkarDateInt().toString(), "%-$session")
            )
            cursor.use {
                if (it.moveToFirst()) Pair(it.getInt(0), it.getInt(1)) else Pair(0, 0)
            }
        } ?: Pair(0, 0)
    } catch (e: Exception) {
        Pair(0, 0)
    }
}

private fun todayAthkarDateInt(): Int {
    val calendar = Calendar.getInstance(TimeZone.getDefault())
    val year = calendar.get(Calendar.YEAR)
    val month = calendar.get(Calendar.MONTH) + 1
    val day = calendar.get(Calendar.DAY_OF_MONTH)
    return year * 10000 + month * 100 + day
}

internal const val ATHKAR_SESSION_MORNING = "morning"
internal const val ATHKAR_SESSION_EVENING = "evening"
