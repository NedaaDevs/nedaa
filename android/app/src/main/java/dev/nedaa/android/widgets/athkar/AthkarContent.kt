package dev.nedaa.android.widgets.athkar

import android.content.Context
import android.content.Intent
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
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
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import dev.nedaa.android.R
import dev.nedaa.android.widgets.common.NedaaColors
import dev.nedaa.android.widgets.data.AthkarSummary

/**
 * Content composable for Athkar Progress widget (2x2 fixed)
 */
@Composable
fun AthkarContent(
    summary: AthkarSummary,
    modifier: GlanceModifier = GlanceModifier
) {
    val context = LocalContext.current
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)

    Box(
        modifier = modifier
            .background(NedaaColors.GlanceColors.background)
            .cornerRadius(16.dp)
            .clickable(actionStartActivity(launchIntent ?: Intent()))
            .padding(12.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = GlanceModifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Title
            Text(
                text = context.getString(R.string.widget_athkar),
                style = TextStyle(
                    color = NedaaColors.GlanceColors.primary,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )
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
                    text = "${summary.progressPercentage}%",
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
                            NedaaColors.GlanceColors.textSecondary,
                        fontSize = 12.sp
                    )
                )
                Spacer(modifier = GlanceModifier.width(4.dp))
                Text(
                    text = context.getString(R.string.widget_morning),
                    style = TextStyle(
                        color = NedaaColors.GlanceColors.textSecondary,
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
                            NedaaColors.GlanceColors.textSecondary,
                        fontSize = 12.sp
                    )
                )
                Spacer(modifier = GlanceModifier.width(4.dp))
                Text(
                    text = context.getString(R.string.widget_evening),
                    style = TextStyle(
                        color = NedaaColors.GlanceColors.textSecondary,
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
                        text = "🔥 ${summary.currentStreak}",
                        style = TextStyle(
                            color = NedaaColors.GlanceColors.text,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium
                        )
                    )
                    Spacer(modifier = GlanceModifier.width(4.dp))
                    Text(
                        text = context.getString(R.string.widget_current_streak),
                        style = TextStyle(
                            color = NedaaColors.GlanceColors.textSecondary,
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
                        text = "⭐ ${summary.longestStreak}",
                        style = TextStyle(
                            color = NedaaColors.GlanceColors.text,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium
                        )
                    )
                    Spacer(modifier = GlanceModifier.width(4.dp))
                    Text(
                        text = context.getString(R.string.widget_best_streak),
                        style = TextStyle(
                            color = NedaaColors.GlanceColors.textSecondary,
                            fontSize = 9.sp
                        ),
                        maxLines = 1
                    )
                }
            }
        }
    }
}
