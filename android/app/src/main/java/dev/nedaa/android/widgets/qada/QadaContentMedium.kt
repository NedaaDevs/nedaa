package dev.nedaa.android.widgets.qada

import android.content.Context
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
import dev.nedaa.android.widgets.data.QadaSummary

@Composable
fun QadaContentMedium(
    summary: QadaSummary,
    modifier: GlanceModifier = GlanceModifier
) {
    val context = LocalContext.current
    val deepLinkIntent = Intent(Intent.ACTION_VIEW, Uri.parse("myapp:///qada")).apply {
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
        if (!summary.hasData) {
            NoQadaMediumView(context = context)
        } else {
            Row(
                modifier = GlanceModifier.fillMaxSize(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Left side - Remaining count
                Column(
                    modifier = GlanceModifier.defaultWeight().fillMaxHeight(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = context.getString(R.string.widget_qada_tracker),
                        style = TextStyle(
                            color = NedaaColors.GlanceColors.primary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                    )

                    Spacer(modifier = GlanceModifier.height(6.dp))

                    Box(
                        modifier = GlanceModifier
                            .background(NedaaColors.GlanceColors.primaryBackground)
                            .cornerRadius(10.dp)
                            .padding(horizontal = 20.dp, vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "${summary.remaining}",
                            style = TextStyle(
                                color = NedaaColors.GlanceColors.primary,
                                fontSize = if (summary.remaining >= 100) 24.sp else 30.sp,
                                fontWeight = FontWeight.Bold
                            ),
                            maxLines = 1
                        )
                    }

                    Spacer(modifier = GlanceModifier.height(4.dp))

                    Text(
                        text = context.getString(R.string.widget_fasts_remaining),
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

                // Right side - Progress + Today
                Column(
                    modifier = GlanceModifier.defaultWeight().fillMaxHeight(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = context.getString(R.string.widget_progress),
                        style = TextStyle(
                            color = NedaaColors.GlanceColors.textSecondary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    )

                    Spacer(modifier = GlanceModifier.height(4.dp))

                    // Percentage
                    Text(
                        text = "${summary.completionPercentage}%",
                        style = TextStyle(
                            color = NedaaColors.GlanceColors.primary,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold
                        )
                    )

                    Spacer(modifier = GlanceModifier.height(4.dp))

                    Text(
                        text = context.getString(R.string.widget_completed),
                        style = TextStyle(
                            color = NedaaColors.GlanceColors.textSecondary,
                            fontSize = 11.sp
                        )
                    )

                    // Completed count
                    Spacer(modifier = GlanceModifier.height(6.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "${summary.completed}",
                            style = TextStyle(
                                color = NedaaColors.GlanceColors.success,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                        )

                        if (summary.todayCompleted > 0) {
                            Spacer(modifier = GlanceModifier.width(8.dp))
                            Text(
                                text = "+${summary.todayCompleted}",
                                style = TextStyle(
                                    color = NedaaColors.GlanceColors.success,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NoQadaMediumView(context: Context) {
    Row(
        modifier = GlanceModifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = context.getString(R.string.widget_qada),
            style = TextStyle(
                color = NedaaColors.GlanceColors.primary,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )
        )

        Spacer(modifier = GlanceModifier.width(16.dp))

        Text(
            text = "✓",
            style = TextStyle(
                color = NedaaColors.GlanceColors.success,
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold
            )
        )

        Spacer(modifier = GlanceModifier.width(16.dp))

        Text(
            text = context.getString(R.string.widget_no_qada),
            style = TextStyle(
                color = NedaaColors.GlanceColors.textSecondary,
                fontSize = 13.sp
            )
        )
    }
}
