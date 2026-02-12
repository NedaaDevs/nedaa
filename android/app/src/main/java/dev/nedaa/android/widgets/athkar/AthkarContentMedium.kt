package dev.nedaa.android.widgets.athkar

import android.content.Intent
import android.net.Uri
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
import dev.nedaa.android.widgets.common.NedaaColors
import dev.nedaa.android.widgets.data.AthkarSummary

@Composable
fun AthkarContentMedium(
    summary: AthkarSummary,
    modifier: GlanceModifier = GlanceModifier
) {
    val context = LocalContext.current
    val deepLinkIntent = Intent(Intent.ACTION_VIEW, Uri.parse("myapp:///athkar")).apply {
        setPackage(context.packageName)
    }

    Box(
        modifier = modifier
            .background(NedaaColors.GlanceColors.background)
            .cornerRadius(16.dp)
            .clickable(actionStartActivity(deepLinkIntent))
            .padding(14.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            modifier = GlanceModifier.fillMaxSize(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Left side - Progress percentage + title
            Column(
                modifier = GlanceModifier.defaultWeight().fillMaxHeight(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = context.getString(R.string.widget_athkar),
                    style = TextStyle(
                        color = NedaaColors.GlanceColors.primary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                )

                Spacer(modifier = GlanceModifier.height(6.dp))

                Box(
                    modifier = GlanceModifier
                        .background(NedaaColors.GlanceColors.successBackground)
                        .cornerRadius(10.dp)
                        .padding(horizontal = 20.dp, vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "${summary.progressPercentage}%",
                        style = TextStyle(
                            color = NedaaColors.GlanceColors.success,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold
                        )
                    )
                }

                Spacer(modifier = GlanceModifier.height(4.dp))

                Text(
                    text = context.getString(R.string.widget_today_progress),
                    style = TextStyle(
                        color = NedaaColors.GlanceColors.textSecondary,
                        fontSize = 11.sp
                    ),
                    maxLines = 1
                )
            }

            // Divider
            Spacer(modifier = GlanceModifier.width(12.dp))
            Box(
                modifier = GlanceModifier
                    .width(1.dp)
                    .fillMaxHeight()
                    .padding(vertical = 8.dp)
                    .background(NedaaColors.GlanceColors.textSecondary)
            ) {}
            Spacer(modifier = GlanceModifier.width(12.dp))

            // Right side - Morning/Evening status + Streaks
            Column(
                modifier = GlanceModifier.defaultWeight().fillMaxHeight(),
                horizontalAlignment = Alignment.Start,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Morning status
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = if (summary.morningCompleted) "●" else "○",
                        style = TextStyle(
                            color = if (summary.morningCompleted)
                                NedaaColors.GlanceColors.success
                            else
                                NedaaColors.GlanceColors.textSecondary,
                            fontSize = 14.sp
                        )
                    )
                    Spacer(modifier = GlanceModifier.width(6.dp))
                    Text(
                        text = context.getString(R.string.widget_morning),
                        style = TextStyle(
                            color = NedaaColors.GlanceColors.text,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                    )
                    if (summary.morningCompleted) {
                        Spacer(modifier = GlanceModifier.width(4.dp))
                        Text(
                            text = "✓",
                            style = TextStyle(
                                color = NedaaColors.GlanceColors.success,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        )
                    }
                }

                Spacer(modifier = GlanceModifier.height(6.dp))

                // Evening status
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = if (summary.eveningCompleted) "●" else "○",
                        style = TextStyle(
                            color = if (summary.eveningCompleted)
                                NedaaColors.GlanceColors.success
                            else
                                NedaaColors.GlanceColors.textSecondary,
                            fontSize = 14.sp
                        )
                    )
                    Spacer(modifier = GlanceModifier.width(6.dp))
                    Text(
                        text = context.getString(R.string.widget_evening),
                        style = TextStyle(
                            color = NedaaColors.GlanceColors.text,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                    )
                    if (summary.eveningCompleted) {
                        Spacer(modifier = GlanceModifier.width(4.dp))
                        Text(
                            text = "✓",
                            style = TextStyle(
                                color = NedaaColors.GlanceColors.success,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        )
                    }
                }

                Spacer(modifier = GlanceModifier.height(10.dp))

                // Streaks
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "🔥 ${summary.currentStreak}",
                        style = TextStyle(
                            color = NedaaColors.GlanceColors.text,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    )
                    Spacer(modifier = GlanceModifier.width(6.dp))
                    Text(
                        text = context.getString(R.string.widget_current_streak),
                        style = TextStyle(
                            color = NedaaColors.GlanceColors.textSecondary,
                            fontSize = 11.sp
                        ),
                        maxLines = 1
                    )
                }

                Spacer(modifier = GlanceModifier.height(4.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "⭐ ${summary.longestStreak}",
                        style = TextStyle(
                            color = NedaaColors.GlanceColors.text,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    )
                    Spacer(modifier = GlanceModifier.width(6.dp))
                    Text(
                        text = context.getString(R.string.widget_best_streak),
                        style = TextStyle(
                            color = NedaaColors.GlanceColors.textSecondary,
                            fontSize = 11.sp
                        ),
                        maxLines = 1
                    )
                }
            }
        }
    }
}
