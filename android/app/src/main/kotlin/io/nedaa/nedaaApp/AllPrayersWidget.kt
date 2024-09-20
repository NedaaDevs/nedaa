package io.nedaa.nedaaApp


import HomeWidgetGlanceStateDefinition
import android.content.Context
import android.content.res.Configuration
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
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.state.GlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import io.nedaa.nedaaApp.WidgetComposables.DisplayErrorMsg
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Duration
import java.time.ZonedDateTime
import java.util.Locale


class AllPrayersWidget : GlanceAppWidget() {
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
        val prayers = remember { mutableStateOf<List<Prayer>>(emptyList()) }
        val nextPrayer = remember { mutableStateOf<Prayer?>(null) }

        LaunchedEffect(key1 = Unit) {
            prayerService.openDb()
            val todayPrayers = withContext(Dispatchers.IO) {
                prayerService.getTodayPrayers()?.prayers ?: emptyList()
            }
            val next = withContext(Dispatchers.IO) {
                prayerService.getNextPrayer()
            }
            val updatedPrayers = if (next?.name == "fajr") {
                withContext(Dispatchers.IO) {
                    prayerService.getTomorrowPrayers()?.prayers ?: emptyList()
                }
            } else {
                todayPrayers
            }
            prayerService.closeDb()
            prayers.value = updatedPrayers
            nextPrayer.value = next

            val durationTillNextPrayer =
                prayerService.durationUntilNextPrayer(nextPrayer.value?.dateTime)

            // Schedule the WorkManager to handle the next prayer update
            scheduleWidgetUpdate(context, durationTillNextPrayer)
        }

        val isDark = isSystemInDarkTheme(context)
        AllPrayersContent(context, prayers.value, nextPrayer.value, isDark)
    }

    private fun isSystemInDarkTheme(context: Context): Boolean {
        return context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
    }


    private fun getTranslation(context: Context, message: String, date: ZonedDateTime?): String {
        val resourceId = when (message) {
            "fajr" -> R.string.fajr
            "sunrise" -> R.string.sunrise
            "dhuhr" -> if (duhurOrJumah(date)) R.string.jumaa else R.string.dhuhr
            "asr" -> R.string.asr
            "maghrib" -> R.string.maghrib
            "isha" -> R.string.isha
            "enable_exact_alarm_permission_message" -> R.string.enable_exact_alarm_permission_message
            "allow" -> R.string.allow
            else -> {
                R.string.empty
            }
        }
        return context.getString(resourceId)
    }

    private fun duhurOrJumah(datetime: ZonedDateTime?): Boolean {
        // if the current day is 5 (Friday) return true
        return ZonedDateTime.now(datetime?.zone).dayOfWeek.value == 5
    }


    @Composable
    fun AllPrayersContent(
        context: Context,
        prayers: List<Prayer>,
        nextPrayer: Prayer?,
        isDark: Boolean
    ) {
        val primaryColor = if (isDark) GlanceTheme.colors.primary else GlanceTheme.colors.secondary
        val secondaryColor =
            if (isDark) GlanceTheme.colors.secondary else GlanceTheme.colors.primary
        val backgroundColor =
            if (isDark) GlanceTheme.colors.background else GlanceTheme.colors.background
        val highlightedBackgroundColor =
            if (isDark) GlanceTheme.colors.tertiary else GlanceTheme.colors.background

        Column(
            modifier = GlanceModifier.background(backgroundColor).fillMaxSize(),
            horizontalAlignment = Alignment.Horizontal.CenterHorizontally,
            verticalAlignment = Alignment.Vertical.CenterVertically
        ) {
            prayers.forEach { prayer ->
                val isNext = prayer.name == nextPrayer?.name
                val nextColor = if (isNext) secondaryColor else primaryColor
                val rowBackgroundColor = if (isNext) highlightedBackgroundColor else backgroundColor

                Row(
                    modifier = GlanceModifier
                        .fillMaxWidth()
                        .background(rowBackgroundColor)
                        .padding(8.dp),
                ) {
                    Text(
                        text = getTranslation(
                            context,
                            prayer.name,
                            prayer.dateTime
                        ).replaceFirstChar {
                            if (it.isLowerCase()) it.titlecase(Locale.ROOT) else it.toString()
                        },
                        style = TextStyle(
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Normal,
                            color = nextColor
                        ),
                        modifier = GlanceModifier.padding(end = 8.dp)
                    )

                    Spacer(modifier = GlanceModifier.defaultWeight())

                    Text(
                        text = prayer.getFormattedTime(),
                        style = TextStyle(
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Normal,
                            color = nextColor
                        )
                    )
                }


            }
        }
    }

    private fun scheduleWidgetUpdate(context: Context, durationTillNextPrayer: Duration) {
        val widgetUpdateWork = OneTimeWorkRequest.Builder(AllPrayersWidgetWorker::class.java)
            .setInitialDelay(
                durationTillNextPrayer.toMillis(),
                java.util.concurrent.TimeUnit.MILLISECONDS
            )
            .addTag("AllPrayersWidgetWorker")
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            "AllPrayersWidgetWorker",
            ExistingWorkPolicy.REPLACE,
            widgetUpdateWork
        )


    }


}


class AllPrayersWidgetWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        try {
            AllPrayersWidget().apply {
                updateAll(applicationContext)
            }
            return Result.success()
        } catch (e: Exception) {
            Log.e("AllPrayersWidgetWorker", "Error updating widget", e)
            return Result.failure()
        }
    }
}

