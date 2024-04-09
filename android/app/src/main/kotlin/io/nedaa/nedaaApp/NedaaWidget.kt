package io.nedaa.nedaaApp

import android.content.Context
import android.net.Uri
import HomeWidgetGlanceStateDefinition
import HomeWidgetGlanceState
import android.content.res.Configuration
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.ActionParameters
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequest
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import es.antonborri.home_widget.HomeWidgetBackgroundIntent
import es.antonborri.home_widget.actionStartActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Duration


class NedaaWidgetWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        NedaaWidget().apply {
            applicationContext
            // Call update/updateAll in case a Worker for the widget is not currently running.
            updateAll(applicationContext)
        }
        return Result.success()
    }
}

class NedaaWidget : GlanceAppWidget() {
    private lateinit var prayerService: PrayerTimeService

    object ColorScheme {
        private val DarkColors = darkColorScheme(
            primary = Color(0xFFCBB279),
            secondary = Color(0xFFEEEEEE),
            tertiary = Color(0xFFE1D4BB),
            background = Color(0xFF537188),
        )

        private val LightColors = lightColorScheme(
            primary = Color(0xFF537188),
            secondary = Color(0xFFCBB279),
            tertiary = Color(0xFFE1D4BB),
            background = Color(0xFFEEEEEE),
        )

        val colors = androidx.glance.material3.ColorProviders(
            light = LightColors, dark = DarkColors
        )
    }

    /**
     * Needed for Updating
     */
    override val stateDefinition = HomeWidgetGlanceStateDefinition()

    @RequiresApi(Build.VERSION_CODES.O)
    override suspend fun provideGlance(context: Context, id: GlanceId) {

        prayerService = PrayerTimeService(context)

//        TODO: set the interval to the next prayer time.
        // Create unique periodic work to keep this widget updated at a regular interval.
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "nedaaWidgetWorker",
            ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequest.Builder(
                NedaaWidgetWorker::class.java,
                Duration.ofMinutes(15)
            ).setInitialDelay(Duration.ofMinutes(15)).build()
        )

        provideContent {
            GlanceTheme(colors = ColorScheme.colors) {
                GlanceContent(context, currentState(), prayerService)
            }
        }
    }

    @Composable
    private fun GlanceContent(
        context: Context,
        currentState: HomeWidgetGlanceState,
        prayerService: PrayerTimeService
    ) {
        val data = currentState.preferences
        val nextPrayer = remember { mutableStateOf<Prayer?>(null) }
        val prevPrayer = remember { mutableStateOf<Prayer?>(null) }

//        Run the db query in the background thread
        LaunchedEffect(key1 = Unit) {
            prayerService.openDb()
            val both = withContext(Dispatchers.IO) {
                val next = prayerService.getNextPrayer()
                val prev = prayerService.getPreviousPrayer()
                prayerService.closeDb()
                return@withContext Pair(next, prev)
            }
            nextPrayer.value = both.first
            prevPrayer.value = both.second
        }

        val nextPrayerName = nextPrayer.value?.name
        val nextPrayerTime = nextPrayer.value?.getFormattedTime()

        val prevPrayerName = prevPrayer.value?.name
        val prevPrayerTime = prevPrayer.value?.getFormattedTime()

        val isDark = isSystemInDarkTheme(context)

        println("isDark $isDark")

        Content(
            context,
            prevPrayerName ?: "",
            prevPrayerTime ?: "",
            nextPrayerName ?: "",
            nextPrayerTime ?: "",
            isDark
        )
    }

    fun isSystemInDarkTheme(context: Context): Boolean {
        return context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
    }


    @Composable
    fun Content(
        context: Context,
        prevPrayerName: String,
        prevPrayerTime: String,
        nextPrayerName: String,
        nextPrayerTime: String,
        isDark: Boolean
    ) {

        val prevColor = if (isDark) GlanceTheme.colors.background else GlanceTheme.colors.primary
        Column(
            modifier = GlanceModifier.background(GlanceTheme.colors.background).fillMaxSize()
                .clickable(onClick = actionStartActivity<MainActivity>(context)),
            horizontalAlignment = Alignment.Horizontal.CenterHorizontally,
            verticalAlignment = Alignment.Vertical.CenterVertically
        ) {
            Box(
                modifier = GlanceModifier.background(GlanceTheme.colors.tertiary)
                    .cornerRadius(16.dp)
            ) {

                Column(
                    modifier = GlanceModifier.padding(32.dp, 4.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,

                    ) {
                    Text(
                        text = prevPrayerName,
                        modifier = GlanceModifier.padding(bottom = 4.dp),
                        style = TextStyle(color = prevColor)
                    )
                    Text(
                        text = prevPrayerTime,
                        modifier = GlanceModifier.padding(bottom = 4.dp),
                        style = TextStyle(color = prevColor)
                    )
                }
            }

            Spacer(modifier = GlanceModifier.height(16.dp))
            Spacer(modifier = GlanceModifier.height(2.dp).background(GlanceTheme.colors.primary))
            Spacer(modifier = GlanceModifier.height(12.dp))

            Text(
                text = nextPrayerName, style = TextStyle(
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = GlanceTheme.colors.primary
                ), modifier = GlanceModifier.padding(bottom = 4.dp)
            )
            Text(
                text = nextPrayerTime,
                style = TextStyle(
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = GlanceTheme.colors.secondary
                ),
                modifier = GlanceModifier.padding(bottom = 4.dp)
            )
        }
    }


}

class InteractiveAction : ActionCallback {
    override suspend fun onAction(
        context: Context, glanceId: GlanceId, parameters: ActionParameters
    ) {
        val backgroundIntent = HomeWidgetBackgroundIntent.getBroadcast(
            context, Uri.parse("nedaaWidget://titleClicked")
        )
        backgroundIntent.send()
    }
}