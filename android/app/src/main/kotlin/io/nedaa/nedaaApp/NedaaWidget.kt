package io.nedaa.nedaaApp

import HomeWidgetGlanceStateDefinition
import android.content.Context
import android.content.res.Configuration
import android.net.Uri
import android.util.Log
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
import es.antonborri.home_widget.HomeWidgetBackgroundIntent
import es.antonborri.home_widget.actionStartActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Duration
import java.time.ZonedDateTime
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import io.nedaa.nedaaApp.WidgetComposables.DisplayErrorMsg


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
     override val stateDefinition: GlanceStateDefinition<*>?
        get() = HomeWidgetGlanceStateDefinition()

    override suspend fun provideGlance(context: Context, id: GlanceId) {

        prayerService = PrayerTimeService(context)

        provideContent {
            GlanceTheme(colors = ColorScheme.colors) {
                if (PermissionUtil.canScheduleExactAlarms(context)) {
                    GlanceContent(context, prayerService)
                } else {
                    DisplayErrorMsg(context)
                }
            }
        }
    }

    @Composable
    private fun GlanceContent(
        context: Context,
        prayerService: PrayerTimeService
    ) {
        val nextPrayer = remember { mutableStateOf<Prayer?>(null) }
        val prevPrayer = remember { mutableStateOf<Prayer?>(null) }

        // Run the db query in the background thread
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
            val durationTillNextPrayer =
                prayerService.durationUntilNextPrayer(nextPrayer.value?.dateTime)


            // Schedule the WorkManager to handle the next prayer update
            scheduleWidgetUpdate(context, durationTillNextPrayer)

        }

        val nextPrayerName =
            getPrayerName(context, nextPrayer.value?.name, nextPrayer.value?.dateTime)
        val nextPrayerTime = nextPrayer.value?.getFormattedTime()

        val prevPrayerName =
            getPrayerName(context, prevPrayer.value?.name, prevPrayer.value?.dateTime)
        val prevPrayerTime = prevPrayer.value?.getFormattedTime()

        val isDark = isSystemInDarkTheme(context)

        Content(
            context,
            prevPrayerName,
            prevPrayerTime ?: "",
            nextPrayerName,
            nextPrayerTime ?: "",
            isDark
        )
    }

    private fun isSystemInDarkTheme(context: Context): Boolean {
        return context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
    }

    private fun getPrayerName(context: Context, prayerName: String?, date: ZonedDateTime?): String {
        val resourceId = when (prayerName) {
            "fajr" -> R.string.fajr
            "sunrise" -> R.string.sunrise
            "dhuhr" -> if (duhurOrJumah(date)) R.string.jumaa else R.string.dhuhr
            "asr" -> R.string.asr
            "maghrib" -> R.string.maghrib
            "isha" -> R.string.isha
            else -> R.string.fajr
        }
        return context.getString(resourceId)
    }

    private fun duhurOrJumah(datetime: ZonedDateTime?): Boolean {
        // if the current day is 5 (Friday) return true
        return ZonedDateTime.now(datetime?.zone).dayOfWeek.value == 5
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
                        style = TextStyle(
                            color = prevColor,
                            fontWeight = FontWeight.Bold
                        )
                    )
                    Text(
                        text = prevPrayerTime,
                        modifier = GlanceModifier.padding(bottom = 4.dp),
                        style = TextStyle(
                            color = prevColor,
                            fontWeight = FontWeight.Bold
                        )
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

    private fun scheduleWidgetUpdate(context: Context, durationTillNextPrayer: Duration) {
        val widgetUpdateWork = OneTimeWorkRequest.Builder(NedaaWidgetWorker::class.java)
            .setInitialDelay(
                durationTillNextPrayer.toMillis(),
                java.util.concurrent.TimeUnit.MILLISECONDS
            )
            .addTag("WidgetUpdateWork")
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            "WidgetUpdateWork",
            ExistingWorkPolicy.REPLACE,
            widgetUpdateWork
        )


    }
}

class NedaaWidgetWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        try {
            NedaaWidget().apply {
                updateAll(applicationContext)
                Log.d("NedaaWidgetWorker", "Widget updated")
            }
            return Result.success()
        } catch (e: Exception) {
            Log.e("NedaaWidgetWorker", "Error updating widget", e)
            return Result.failure()
        }
    }
}


class NedaaInteractiveAction : ActionCallback {
    override suspend fun onAction(
        context: Context, glanceId: GlanceId, parameters: ActionParameters
    ) {
        val backgroundIntent = HomeWidgetBackgroundIntent.getBroadcast(
            context, Uri.parse("nedaaWidget://titleClicked")
        )
        backgroundIntent.send()
    }
}