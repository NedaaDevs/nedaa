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

/** Medium Athkar widget (4x2), resizable down to the Compact (2x2) layout. */
class AthkarWidgetMedium : GlanceAppWidget() {

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
