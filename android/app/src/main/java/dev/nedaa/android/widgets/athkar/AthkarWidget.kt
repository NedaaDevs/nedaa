package dev.nedaa.android.widgets.athkar

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.fillMaxSize
import dev.nedaa.android.widgets.common.NedaaWidgetTheme
import dev.nedaa.android.widgets.common.WidgetConfig
import dev.nedaa.android.widgets.common.WidgetSizes
import dev.nedaa.android.widgets.data.AthkarDataService
import dev.nedaa.android.widgets.data.PrayerData
import dev.nedaa.android.widgets.data.PrayerDataService

/**
 * Athkar Progress home screen widget (2x2), resizable up to the Medium (4x2) layout.
 * Shows morning/evening completion, streaks, and daily progress
 */
class AthkarWidget : GlanceAppWidget() {

    override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.COMPACT, WidgetSizes.MEDIUM))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val config = WidgetConfig.get(context)
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
internal fun sessionAthkarProgress(context: Context, session: String): Pair<Int, Int> =
    AthkarDataService(context).sessionProgress(session)

internal const val ATHKAR_SESSION_MORNING = "morning"
internal const val ATHKAR_SESSION_EVENING = "evening"
