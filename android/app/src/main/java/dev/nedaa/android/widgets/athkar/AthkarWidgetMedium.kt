package dev.nedaa.android.widgets.athkar

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.fillMaxSize
import dev.nedaa.android.widgets.data.AthkarDataService

class AthkarWidgetMedium : GlanceAppWidget() {

    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val athkarService = AthkarDataService(context)
            val summary = athkarService.getAthkarSummary()

            AthkarContentMedium(
                summary = summary,
                modifier = GlanceModifier.fillMaxSize()
            )
        }
    }
}
