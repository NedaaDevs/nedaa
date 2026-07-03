package dev.nedaa.android.widgets.qada

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
import dev.nedaa.android.widgets.data.QadaDataService
import dev.nedaa.android.widgets.importantdays.ImportantDaysDataService

/** Medium Qada widget (4x2), resizable down to the Compact (2x2) layout. */
class QadaWidgetMedium : GlanceAppWidget() {

    override val sizeMode = SizeMode.Responsive(setOf(WidgetSizes.COMPACT, WidgetSizes.MEDIUM))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val config = WidgetConfig.get(context)
        provideContent {
            val qadaService = QadaDataService(context)
            val summary = qadaService.getQadaSummary()
            val ramadanDeadline = ramadanDeadlineLine(context, config)

            NedaaWidgetTheme {
                ResponsiveQadaContent(
                    summary = summary,
                    ramadanDeadline = ramadanDeadline,
                    config = config,
                    modifier = GlanceModifier.fillMaxSize()
                )
            }
        }
    }
}
