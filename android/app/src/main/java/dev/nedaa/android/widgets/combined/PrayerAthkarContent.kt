package dev.nedaa.android.widgets.combined

import android.content.Context
import android.content.Intent
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.LocalContext
import androidx.glance.action.clickable
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
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
import dev.nedaa.android.widgets.data.AthkarSummary
import dev.nedaa.android.widgets.data.PrayerData
import java.util.Date
import java.util.TimeZone

/**
 * Combined Prayer + Athkar widget (4x2)
 * Layout: Date centered at top, Prayer box on left, Athkar rows on right
 */
@Composable
fun PrayerAthkarContent(
    prayers: List<PrayerData>,
    nextPrayer: PrayerData?,
    previousPrayer: PrayerData?,
    athkarSummary: AthkarSummary,
    config: WidgetConfig,
    timezone: TimeZone? = null,
    currentDate: Date? = null,
    modifier: GlanceModifier = GlanceModifier
) {
    val context = LocalContext.current
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val tz = timezone ?: TimeZone.getDefault()

    android.util.Log.d("CombinedWidget", "Rendering: nextPrayer=${nextPrayer?.name}, previousPrayer=${previousPrayer?.name}, athkar=${athkarSummary.progressPercentage}%")

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(GlanceTheme.colors.background)
            .cornerRadius(16.dp)
            .clickable(actionStartActivity(launchIntent ?: Intent()))
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Hijri date centered at top (compact for tight 4x2 layout)
        Text(
            text = config.localizeNumber(
                DateUtils.getHijriDateStringCompact(currentDate ?: Date(), tz, config.locale)
            ),
            style = TextStyle(
                color = GlanceTheme.colors.onSurfaceVariant,
                fontSize = 11.sp
            ),
            maxLines = 1
        )

        Spacer(modifier = GlanceModifier.height(8.dp))

        // Main content row
        Row(
            modifier = GlanceModifier.fillMaxWidth().defaultWeight(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Left: Prayer section (Previous + Next)
            PrayerSection(
                nextPrayer = nextPrayer,
                previousPrayer = previousPrayer,
                timezone = tz,
                context = context,
                config = config,
                modifier = GlanceModifier.defaultWeight().fillMaxHeight()
            )

            Spacer(modifier = GlanceModifier.width(8.dp))

            // Subtle vertical divider
            Box(
                modifier = GlanceModifier
                    .width(1.dp)
                    .fillMaxHeight()
                    .padding(vertical = 8.dp)
            ) {
                Box(
                    modifier = GlanceModifier
                        .width(1.dp)
                        .fillMaxHeight()
                        .background(NedaaColors.GlanceColors.divider)
                ) {}
            }

            Spacer(modifier = GlanceModifier.width(8.dp))

            // Right: Athkar Section
            AthkarSection(
                athkarSummary = athkarSummary,
                context = context,
                config = config,
                modifier = GlanceModifier.defaultWeight().fillMaxHeight()
            )
        }
    }
}

@Composable
private fun PrayerSection(
    nextPrayer: PrayerData?,
    previousPrayer: PrayerData?,
    timezone: TimeZone,
    context: Context,
    config: WidgetConfig,
    modifier: GlanceModifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Previous prayer row
        PrayerRow(
            label = context.getString(R.string.widget_previous),
            prayer = previousPrayer,
            timezone = timezone,
            context = context,
            config = config,
            isPrimary = false
        )

        Spacer(modifier = GlanceModifier.height(4.dp))

        // Next prayer row
        PrayerRow(
            label = context.getString(R.string.widget_next),
            prayer = nextPrayer,
            timezone = timezone,
            context = context,
            config = config,
            isPrimary = true
        )
    }
}

@Composable
private fun PrayerRow(
    label: String,
    prayer: PrayerData?,
    timezone: TimeZone,
    context: Context,
    config: WidgetConfig,
    isPrimary: Boolean
) {
    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .background(
                if (isPrimary) NedaaColors.GlanceColors.primaryBackground
                else GlanceTheme.colors.background
            )
            .cornerRadius(8.dp)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Label (Previous/Next)
        Text(
            text = label,
            style = TextStyle(
                color = GlanceTheme.colors.onSurfaceVariant,
                fontSize = 9.sp
            )
        )

        Spacer(modifier = GlanceModifier.width(6.dp))

        if (prayer != null) {
            // Prayer name
            Text(
                text = getPrayerDisplayName(prayer.name, context),
                style = TextStyle(
                    color = if (isPrimary) GlanceTheme.colors.primary
                           else GlanceTheme.colors.onBackground,
                    fontSize = if (isPrimary) 12.sp else 10.sp,
                    fontWeight = if (isPrimary) FontWeight.Bold else FontWeight.Medium
                ),
                maxLines = 1
            )

            Spacer(modifier = GlanceModifier.defaultWeight())

            // Prayer time
            Text(
                text = config.localizeNumber(prayer.formatTime12Hour(timezone, config.locale)),
                style = TextStyle(
                    color = if (isPrimary) GlanceTheme.colors.onBackground
                           else GlanceTheme.colors.onSurfaceVariant,
                    fontSize = if (isPrimary) 11.sp else 10.sp,
                    fontWeight = if (isPrimary) FontWeight.Medium else FontWeight.Normal
                ),
                maxLines = 1
            )
        } else {
            Text(
                text = "-",
                style = TextStyle(
                    color = GlanceTheme.colors.onSurfaceVariant,
                    fontSize = 11.sp
                )
            )
        }
    }
}

@Composable
private fun AthkarSection(
    athkarSummary: AthkarSummary,
    context: Context,
    config: WidgetConfig,
    modifier: GlanceModifier
) {
    android.util.Log.d("CombinedWidget", "AthkarSection: current=${athkarSummary.currentStreak}, longest=${athkarSummary.longestStreak}")

    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Athkar header
        Text(
            text = context.getString(R.string.widget_athkar),
            style = TextStyle(
                color = GlanceTheme.colors.onSurfaceVariant,
                fontSize = 10.sp
            )
        )

        Spacer(modifier = GlanceModifier.height(4.dp))

        // Morning completion row
        CompletionRow(
            isCompleted = athkarSummary.morningCompleted,
            label = context.getString(R.string.widget_morning)
        )

        Spacer(modifier = GlanceModifier.height(4.dp))

        // Evening completion row
        CompletionRow(
            isCompleted = athkarSummary.eveningCompleted,
            label = context.getString(R.string.widget_evening)
        )

        Spacer(modifier = GlanceModifier.height(4.dp))

        // Streaks (stacked vertically to prevent horizontal overflow)
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = config.localizeNumber("🔥 ${athkarSummary.currentStreak}"),
                    style = TextStyle(
                        color = GlanceTheme.colors.onBackground,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium
                    )
                )
                Spacer(modifier = GlanceModifier.width(4.dp))
                Text(
                    text = context.getString(R.string.widget_current_streak),
                    style = TextStyle(
                        color = GlanceTheme.colors.onSurfaceVariant,
                        fontSize = 9.sp
                    ),
                    maxLines = 1
                )
            }

            Spacer(modifier = GlanceModifier.height(2.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = config.localizeNumber("⭐ ${athkarSummary.longestStreak}"),
                    style = TextStyle(
                        color = GlanceTheme.colors.onBackground,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium
                    )
                )
                Spacer(modifier = GlanceModifier.width(4.dp))
                Text(
                    text = context.getString(R.string.widget_best_streak),
                    style = TextStyle(
                        color = GlanceTheme.colors.onSurfaceVariant,
                        fontSize = 9.sp
                    ),
                    maxLines = 1
                )
            }
        }
    }
}

@Composable
private fun CompletionRow(
    isCompleted: Boolean,
    label: String
) {
    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .background(
                if (isCompleted) NedaaColors.GlanceColors.successBackground
                else NedaaColors.GlanceColors.primaryBackground
            )
            .cornerRadius(8.dp)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = if (isCompleted) "✓" else "○",
            style = TextStyle(
                color = if (isCompleted) NedaaColors.GlanceColors.success
                       else GlanceTheme.colors.onSurfaceVariant,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
        )
        Spacer(modifier = GlanceModifier.width(6.dp))
        Text(
            text = label,
            style = TextStyle(
                color = if (isCompleted) GlanceTheme.colors.onBackground
                       else GlanceTheme.colors.onSurfaceVariant,
                fontSize = 11.sp,
                fontWeight = if (isCompleted) FontWeight.Medium else FontWeight.Normal
            )
        )
    }
}

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
