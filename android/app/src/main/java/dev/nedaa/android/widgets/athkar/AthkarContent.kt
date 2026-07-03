package dev.nedaa.android.widgets.athkar

import android.content.Context
import android.content.Intent
import android.net.Uri
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
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import dev.nedaa.android.R
import dev.nedaa.android.widgets.common.NedaaColors
import dev.nedaa.android.widgets.common.WidgetConfig
import dev.nedaa.android.widgets.common.WidgetSizes
import dev.nedaa.android.widgets.data.AthkarSummary

/**
 * Picks Compact vs Medium layout from the current Glance size. Used by both athkar receivers
 * under SizeMode.Responsive so a resized widget switches layout instead of clipping.
 */
@Composable
fun ResponsiveAthkarContent(
    summary: AthkarSummary,
    config: WidgetConfig,
    promotedSession: String = "morning",
    modifier: GlanceModifier = GlanceModifier
) {
    val size = LocalSize.current
    if (size.width >= WidgetSizes.MEDIUM.width) {
        AthkarContentMedium(summary = summary, config = config, promotedSession = promotedSession, modifier = modifier)
    } else {
        AthkarContent(summary = summary, config = config, promotedSession = promotedSession, modifier = modifier)
    }
}

/** Localized label for the session ("morning"/"evening") surfaced by [promotedAthkarSession]. */
private fun sessionLabel(session: String, context: Context): String =
    if (session == "evening") context.getString(R.string.widget_evening) else context.getString(R.string.widget_morning)

/**
 * Content composable for Athkar Progress widget (2x2 fixed).
 * [promotedSession] ("morning"/"evening") picks which session's progress the percentage reflects.
 */
@Composable
fun AthkarContent(
    summary: AthkarSummary,
    config: WidgetConfig,
    promotedSession: String = "morning",
    modifier: GlanceModifier = GlanceModifier
) {
    val context = LocalContext.current
    val deepLinkIntent = Intent(Intent.ACTION_VIEW, Uri.parse("myapp:///athkar")).apply {
        setPackage(context.packageName)
    }

    Box(
        modifier = modifier
            .background(GlanceTheme.colors.background)
            .cornerRadius(16.dp)
            .clickable(actionStartActivity(deepLinkIntent))
            .padding(12.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = GlanceModifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Title with the promoted session, e.g. "Athkar · Morning"
            Text(
                text = "${context.getString(R.string.widget_athkar)} · ${sessionLabel(promotedSession, context)}",
                style = TextStyle(
                    color = GlanceTheme.colors.primary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                ),
                maxLines = 1
            )

            Spacer(modifier = GlanceModifier.height(8.dp))

            // Progress percentage in a colored box
            Box(
                modifier = GlanceModifier
                    .background(NedaaColors.GlanceColors.successBackground)
                    .cornerRadius(8.dp)
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = config.localizeNumber("${summary.progressPercentage}%"),
                    style = TextStyle(
                        color = NedaaColors.GlanceColors.success,
                        fontSize = 26.sp,
                        fontWeight = FontWeight.Bold
                    )
                )
            }

            Spacer(modifier = GlanceModifier.height(8.dp))

            // Morning/Evening status with dots
            Row(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Morning
                Text(
                    text = if (summary.morningCompleted) "●" else "○",
                    style = TextStyle(
                        color = if (summary.morningCompleted)
                            NedaaColors.GlanceColors.success
                        else
                            GlanceTheme.colors.onSurfaceVariant,
                        fontSize = 12.sp
                    )
                )
                Spacer(modifier = GlanceModifier.width(4.dp))
                Text(
                    text = context.getString(R.string.widget_morning),
                    style = TextStyle(
                        color = GlanceTheme.colors.onSurfaceVariant,
                        fontSize = 11.sp
                    )
                )

                Spacer(modifier = GlanceModifier.width(12.dp))

                // Evening
                Text(
                    text = if (summary.eveningCompleted) "●" else "○",
                    style = TextStyle(
                        color = if (summary.eveningCompleted)
                            NedaaColors.GlanceColors.success
                        else
                            GlanceTheme.colors.onSurfaceVariant,
                        fontSize = 12.sp
                    )
                )
                Spacer(modifier = GlanceModifier.width(4.dp))
                Text(
                    text = context.getString(R.string.widget_evening),
                    style = TextStyle(
                        color = GlanceTheme.colors.onSurfaceVariant,
                        fontSize = 11.sp
                    )
                )
            }

            // Streaks (stacked vertically to prevent horizontal overflow on 2x2)
            Spacer(modifier = GlanceModifier.height(4.dp))
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = config.localizeNumber("🔥 ${summary.currentStreak}"),
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
                        text = config.localizeNumber("⭐ ${summary.longestStreak}"),
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
}
