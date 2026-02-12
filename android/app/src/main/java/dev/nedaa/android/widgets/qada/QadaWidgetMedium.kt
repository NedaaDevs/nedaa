package dev.nedaa.android.widgets.qada

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.fillMaxSize
import dev.nedaa.android.widgets.data.QadaDataService

class QadaWidgetMedium : GlanceAppWidget() {

    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val qadaService = QadaDataService(context)
            val summary = qadaService.getQadaSummary()

            QadaContentMedium(
                summary = summary,
                modifier = GlanceModifier.fillMaxSize()
            )
        }
    }
}
