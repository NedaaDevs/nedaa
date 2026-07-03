package dev.nedaa.android.widgets.prayer

import android.content.Context
import android.content.Intent
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import dev.nedaa.android.R
import dev.nedaa.android.widgets.common.DateUtils
import dev.nedaa.android.widgets.common.NedaaColors
import dev.nedaa.android.widgets.common.WidgetConfig
import dev.nedaa.android.widgets.common.WidgetSizes
import dev.nedaa.android.widgets.data.DayPrayers
import dev.nedaa.android.widgets.data.PrayerData
import java.util.Date
import java.util.TimeZone

/**
 * Widget size enum for explicit size selection
 */
enum class WidgetSize {
    SMALL,
    MEDIUM,
    LARGE
}

/**
 * Picks the [WidgetSize] bucket from the current Glance size and renders [PrayerTimesContent].
 * Used by all three prayer receivers (Small/Medium/Large) under SizeMode.Responsive so a
 * resized widget switches layout instead of clipping.
 */
@Composable
fun ResponsivePrayerTimesContent(
    dayPrayers: DayPrayers?,
    nextPrayer: PrayerData?,
    previousPrayer: PrayerData?,
    config: WidgetConfig,
    modifier: GlanceModifier = GlanceModifier
) {
    val size = LocalSize.current
    val widgetSize = when {
        size.width >= WidgetSizes.MEDIUM.width && size.height >= WidgetSizes.WIDE.height -> WidgetSize.LARGE
        size.width >= WidgetSizes.MEDIUM.width -> WidgetSize.MEDIUM
        else -> WidgetSize.SMALL
    }
    PrayerTimesContent(
        dayPrayers = dayPrayers,
        nextPrayer = nextPrayer,
        previousPrayer = previousPrayer,
        widgetSize = widgetSize,
        config = config,
        modifier = modifier
    )
}

/**
 * Main content composable for Prayer Times widget
 * Uses explicit widget size selection
 */
@Composable
fun PrayerTimesContent(
    dayPrayers: DayPrayers?,
    nextPrayer: PrayerData?,
    previousPrayer: PrayerData?,
    widgetSize: WidgetSize,
    config: WidgetConfig,
    modifier: GlanceModifier = GlanceModifier
) {
    val context = LocalContext.current

    // Get launch intent for main app
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)

    Box(
        modifier = modifier
            .background(GlanceTheme.colors.background)
            .cornerRadius(16.dp)
            .clickable(actionStartActivity(launchIntent ?: Intent()))
            .padding(12.dp),
        contentAlignment = Alignment.Center
    ) {
        if (dayPrayers == null || dayPrayers.prayers.isEmpty()) {
            NoDataView(context)
        } else {
            val timezone = dayPrayers.getTimezoneObj()
            val currentDate = dayPrayers.getDateAsDate()

            when (widgetSize) {
                WidgetSize.SMALL -> SmallPrayerTimesView(
                    nextPrayer = nextPrayer,
                    previousPrayer = previousPrayer,
                    timezone = timezone,
                    currentDate = currentDate,
                    context = context,
                    config = config
                )
                WidgetSize.LARGE -> LargePrayerTimesView(
                    prayers = dayPrayers.prayers,
                    nextPrayer = nextPrayer,
                    previousPrayer = previousPrayer,
                    timezone = timezone,
                    currentDate = currentDate,
                    context = context,
                    config = config
                )
                WidgetSize.MEDIUM -> MediumPrayerTimesView(
                    prayers = dayPrayers.prayers,
                    nextPrayer = nextPrayer,
                    timezone = timezone,
                    currentDate = currentDate,
                    context = context,
                    config = config
                )
            }
        }
    }
}

/**
 * Small widget view - shows Hijri date, previous and next prayer
 */
@Composable
private fun SmallPrayerTimesView(
    nextPrayer: PrayerData?,
    previousPrayer: PrayerData?,
    timezone: TimeZone,
    currentDate: Date,
    context: Context,
    config: WidgetConfig
) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .padding(top = 8.dp, start = 8.dp, end = 8.dp, bottom = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Weekday and Hijri date at top (compact for small widget)
        Text(
            text = DateUtils.getWeekdayName(currentDate, timezone, config.locale),
            style = TextStyle(
                color = GlanceTheme.colors.primary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium
            ),
            maxLines = 1
        )
        Spacer(modifier = GlanceModifier.height(1.dp))
        Text(
            text = config.localizeNumber(
                DateUtils.getHijriDateStringCompact(currentDate, timezone, config.locale)
            ),
            style = TextStyle(
                color = GlanceTheme.colors.onSurfaceVariant,
                fontSize = 10.sp
            ),
            maxLines = 1
        )

        Spacer(modifier = GlanceModifier.height(6.dp))

        // Previous Prayer section with green background
        if (previousPrayer != null) {
            Box(
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .background(NedaaColors.GlanceColors.successBackground)
                    .cornerRadius(8.dp)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = getPrayerDisplayName(previousPrayer.name, context),
                        style = TextStyle(
                            color = GlanceTheme.colors.onSurfaceVariant,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium
                        ),
                        maxLines = 1
                    )
                    Text(
                        text = config.localizeNumber(previousPrayer.formatTime12Hour(timezone, config.locale)),
                        style = TextStyle(
                            color = GlanceTheme.colors.onSurfaceVariant,
                            fontSize = 12.sp
                        )
                    )
                }
            }
        }

        // Spacer to push next prayer down (responsive)
        Spacer(modifier = GlanceModifier.defaultWeight())

        // Divider line
        Box(
            modifier = GlanceModifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .height(1.dp)
                .background(NedaaColors.GlanceColors.divider)
        ) {}

        // Spacer to push next prayer down (responsive)
        Spacer(modifier = GlanceModifier.defaultWeight())

        // Next Prayer section (prominent)
        if (nextPrayer != null) {
            Column(
                modifier = GlanceModifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = getPrayerDisplayName(nextPrayer.name, context),
                    style = TextStyle(
                        color = GlanceTheme.colors.primary,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold
                    ),
                    maxLines = 1
                )

                Spacer(modifier = GlanceModifier.height(2.dp))

                Text(
                    text = config.localizeNumber(nextPrayer.formatTime12Hour(timezone, config.locale)),
                    style = TextStyle(
                        color = GlanceTheme.colors.onBackground,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Medium
                    )
                )
            }
        } else {
            Text(
                text = context.getString(R.string.widget_no_data),
                style = TextStyle(
                    color = GlanceTheme.colors.onSurfaceVariant,
                    fontSize = 12.sp
                )
            )
        }

        Spacer(modifier = GlanceModifier.height(4.dp))
    }
}

/**
 * Medium widget view - horizontal layout with all prayers in columns
 */
@Composable
private fun MediumPrayerTimesView(
    prayers: List<PrayerData>,
    nextPrayer: PrayerData?,
    timezone: TimeZone,
    currentDate: Date,
    context: Context,
    config: WidgetConfig
) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Header with moon icon, Hijri date and Gregorian date
        Row(
            modifier = GlanceModifier
                .fillMaxWidth()
                .padding(bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Moon icon
            Text(
                text = "☪",
                style = TextStyle(
                    color = GlanceTheme.colors.primary,
                    fontSize = 14.sp
                )
            )

            Spacer(modifier = GlanceModifier.width(6.dp))

            // Hijri date
            Text(
                text = config.localizeNumber(
                    DateUtils.getHijriDateString(currentDate, timezone, config.locale)
                ),
                style = TextStyle(
                    color = GlanceTheme.colors.onSurfaceVariant,
                    fontSize = 12.sp
                ),
                maxLines = 1
            )

            Spacer(modifier = GlanceModifier.defaultWeight())

            // Gregorian date
            Text(
                text = config.localizeNumber(
                    DateUtils.getGregorianDateShort(currentDate, timezone, config.locale)
                ),
                style = TextStyle(
                    color = GlanceTheme.colors.onSurfaceVariant,
                    fontSize = 12.sp
                )
            )
        }

        // Prayer times in horizontal layout
        Row(
            modifier = GlanceModifier
                .fillMaxWidth()
                .defaultWeight(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalAlignment = Alignment.CenterVertically
        ) {
            prayers.forEach { prayer ->
                val isNext = prayer.name == nextPrayer?.name && prayer.time == nextPrayer?.time
                val isPast = prayer.isPast

                // Each prayer column
                Column(
                    modifier = GlanceModifier
                        .defaultWeight()
                        .padding(horizontal = 2.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Prayer name
                    Text(
                        text = getPrayerDisplayName(prayer.name, context),
                        style = TextStyle(
                            color = if (isNext) GlanceTheme.colors.primary else GlanceTheme.colors.onBackground,
                            fontSize = if (prayers.size > 5) 11.sp else 13.sp,
                            fontWeight = if (isNext) FontWeight.Bold else FontWeight.Medium
                        ),
                        maxLines = 1
                    )

                    Spacer(modifier = GlanceModifier.height(4.dp))

                    // Prayer time
                    Text(
                        text = config.localizeNumber(prayer.formatTime12Hour(timezone, config.locale)),
                        style = TextStyle(
                            color = GlanceTheme.colors.onSurfaceVariant,
                            fontSize = if (prayers.size > 5) 10.sp else 12.sp
                        ),
                        maxLines = 1
                    )

                    Spacer(modifier = GlanceModifier.height(6.dp))

                    // Status dot
                    Box(
                        modifier = GlanceModifier
                            .width(6.dp)
                            .height(6.dp)
                            .cornerRadius(3.dp)
                            .background(
                                when {
                                    isNext -> GlanceTheme.colors.primary
                                    isPast -> NedaaColors.GlanceColors.success
                                    else -> NedaaColors.GlanceColors.divider
                                }
                            )
                    ) {}
                }
            }
        }
    }
}

/**
 * Large widget view - shows header with dates + all prayers with detail
 */
@Composable
private fun LargePrayerTimesView(
    prayers: List<PrayerData>,
    nextPrayer: PrayerData?,
    previousPrayer: PrayerData?,
    timezone: TimeZone,
    currentDate: Date,
    context: Context,
    config: WidgetConfig
) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .padding(horizontal = 14.dp, vertical = 12.dp)
    ) {
        // Header with moon icon
        Row(
            modifier = GlanceModifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Moon icon
            Text(
                text = "☪",
                style = TextStyle(
                    color = GlanceTheme.colors.primary,
                    fontSize = 20.sp
                )
            )

            Spacer(modifier = GlanceModifier.width(8.dp))

            Column(modifier = GlanceModifier.defaultWeight()) {
                Text(
                    text = context.getString(R.string.widget_prayer_times_title),
                    style = TextStyle(
                        color = GlanceTheme.colors.onBackground,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                )

                Spacer(modifier = GlanceModifier.height(2.dp))

                // Both dates
                Row {
                    Text(
                        text = config.localizeNumber(
                            DateUtils.getGregorianDateShort(currentDate, timezone, config.locale)
                        ),
                        style = TextStyle(
                            color = GlanceTheme.colors.onSurfaceVariant,
                            fontSize = 12.sp
                        )
                    )
                    Text(
                        text = " • ",
                        style = TextStyle(
                            color = GlanceTheme.colors.onSurfaceVariant,
                            fontSize = 12.sp
                        )
                    )
                    Text(
                        text = config.localizeNumber(
                            DateUtils.getHijriDateString(currentDate, timezone, config.locale)
                        ),
                        style = TextStyle(
                            color = GlanceTheme.colors.onSurfaceVariant,
                            fontSize = 12.sp
                        )
                    )
                }
            }
        }

        Spacer(modifier = GlanceModifier.height(10.dp))

        // Divider
        Box(
            modifier = GlanceModifier
                .fillMaxWidth()
                .height(1.dp)
                .background(NedaaColors.GlanceColors.divider)
        ) {}

        Spacer(modifier = GlanceModifier.height(10.dp))

        // Prayer list fills the remaining height; each row takes an equal
        // share via defaultWeight so all prayers fit any widget height
        // instead of the last rows clipping off the bottom.
        Column(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) {
            prayers.forEach { prayer ->
                val isNext = prayer.name == nextPrayer?.name && prayer.time == nextPrayer?.time
                val isPrevious = prayer.name == previousPrayer?.name && prayer.time == previousPrayer?.time
                val isPast = prayer.isPast

                PrayerRowLarge(
                    prayer = prayer,
                    isNext = isNext,
                    isPrevious = isPrevious,
                    isPast = isPast,
                    timezone = timezone,
                    context = context,
                    config = config,
                    modifier = GlanceModifier.defaultWeight()
                )
            }
        }
    }
}

/**
 * Prayer row for large widget
 */
@Composable
private fun PrayerRowLarge(
    prayer: PrayerData,
    isNext: Boolean,
    isPrevious: Boolean,
    isPast: Boolean,
    timezone: TimeZone,
    context: Context,
    config: WidgetConfig,
    modifier: GlanceModifier = GlanceModifier
) {
    val backgroundColor = when {
        isNext -> NedaaColors.GlanceColors.primaryBackground
        isPrevious -> NedaaColors.GlanceColors.successBackground
        else -> GlanceTheme.colors.background
    }

    val textColor = when {
        isNext -> GlanceTheme.colors.primary
        isPast -> GlanceTheme.colors.onSurfaceVariant
        else -> GlanceTheme.colors.onBackground
    }

    val dotColor = when {
        isNext -> GlanceTheme.colors.primary
        isPast -> NedaaColors.GlanceColors.success
        else -> GlanceTheme.colors.onSurfaceVariant
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(backgroundColor)
            .cornerRadius(8.dp)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Status dot
        Text(
            text = "●",
            style = TextStyle(
                color = dotColor,
                fontSize = 8.sp
            )
        )

        Spacer(modifier = GlanceModifier.width(8.dp))

        // Prayer name
        Text(
            text = getPrayerDisplayName(prayer.name, context),
            style = TextStyle(
                color = textColor,
                fontSize = 13.sp,
                fontWeight = if (isNext || isPrevious) FontWeight.Bold else FontWeight.Normal
            ),
            modifier = GlanceModifier.defaultWeight()
        )

        // Time
        Text(
            text = config.localizeNumber(prayer.formatTime12Hour(timezone, config.locale)),
            style = TextStyle(
                color = textColor,
                fontSize = 12.sp
            )
        )

        // Label for next/previous
        if (isNext || isPrevious) {
            Spacer(modifier = GlanceModifier.width(8.dp))

            Box(
                modifier = GlanceModifier
                    .background(if (isNext) GlanceTheme.colors.primary else NedaaColors.GlanceColors.success)
                    .cornerRadius(10.dp)
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Text(
                    text = if (isNext) context.getString(R.string.widget_next) else context.getString(R.string.widget_previous),
                    style = TextStyle(
                        color = GlanceTheme.colors.background,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold
                    )
                )
            }
        }
    }
}

/**
 * View shown when no prayer data is available
 */
@Composable
private fun NoDataView(context: Context) {
    Column(
        modifier = GlanceModifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = context.getString(R.string.widget_no_data),
            style = TextStyle(
                color = GlanceTheme.colors.onBackground,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium
            )
        )

        Spacer(modifier = GlanceModifier.height(4.dp))

        Text(
            text = context.getString(R.string.widget_open_app),
            style = TextStyle(
                color = GlanceTheme.colors.onSurfaceVariant,
                fontSize = 11.sp
            )
        )
    }
}

/**
 * Get localized prayer name
 */
private fun getPrayerDisplayName(name: String, context: Context): String {
    return when (name.lowercase()) {
        PrayerData.FAJR -> context.getString(R.string.prayer_fajr)
        PrayerData.SUNRISE -> context.getString(R.string.prayer_sunrise)
        PrayerData.DHUHR -> context.getString(R.string.prayer_dhuhr)
        PrayerData.JUMUAH -> context.getString(R.string.prayer_jumuah)
        PrayerData.ASR -> context.getString(R.string.prayer_asr)
        PrayerData.MAGHRIB -> context.getString(R.string.prayer_maghrib)
        PrayerData.ISHA -> context.getString(R.string.prayer_isha)
        else -> name.replaceFirstChar { it.uppercase() }
    }
}
