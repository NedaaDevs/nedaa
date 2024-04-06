package io.nedaa.nedaaApp

import HomeWidgetGlanceState
import HomeWidgetGlanceStateDefinition
import android.content.Context
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.ActionParameters
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import es.antonborri.home_widget.HomeWidgetBackgroundIntent
import es.antonborri.home_widget.actionStartActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class NedaaWidget : GlanceAppWidget() {
    private lateinit var prayerService: PrayerTimeService

    /**
     * Needed for Updating
     */
    override val stateDefinition = HomeWidgetGlanceStateDefinition()

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            GlanceContent(context, currentState())
        }
    }

    @Composable
    private fun GlanceContent(context: Context, currentState: HomeWidgetGlanceState) {
        val data = currentState.preferences
        prayerService = PrayerTimeService(context)

        val nexPrayer = remember { mutableStateOf<Prayer?>(null) }

//        Run the db query in the background thread
        LaunchedEffect(key1 = Unit) {
            nexPrayer.value = withContext(Dispatchers.IO) {
                prayerService.getNextPrayer()

                println("Before con: $nexPrayer")

                return@withContext prayerService.getNextPrayer()
            }
        }

    
        val nextPrayerName = nexPrayer.value?.name
        val nextPrayerTime = nexPrayer.value?.dateTime

        Box(
            modifier = GlanceModifier.background(Color.White).padding(16.dp)
                .clickable(onClick = actionStartActivity<MainActivity>(context))
        ) {
            Column(
                modifier = GlanceModifier.fillMaxSize(),
                verticalAlignment = Alignment.Vertical.Top,
                horizontalAlignment = Alignment.Horizontal.Start,
            ) {
                Text(
                    nextPrayerName ?: "",
                    style = TextStyle(fontSize = 36.sp, fontWeight = FontWeight.Bold),
//                        modifier = GlanceModifier.clickable(onClick = actionRunCallback<InteractiveAction>()),
                )
                Text(
                    nextPrayerTime.toString() ?: "",
                    style = TextStyle(fontSize = 36.sp, fontWeight = FontWeight.Bold),
                )

            }
        }
    }
}

class InteractiveAction : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val backgroundIntent = HomeWidgetBackgroundIntent.getBroadcast(
            context,
            Uri.parse("nedaaWidget://titleClicked")
        )
        backgroundIntent.send()
    }
}