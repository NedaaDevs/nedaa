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
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import dev.nedaa.android.R
import dev.nedaa.android.widgets.common.NedaaColors
import dev.nedaa.android.widgets.data.QadaSummary

/**
 * Content composable for Qada widget (2x2 fixed)
 */
@Composable
fun QadaContent(
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
            .padding(12.dp),
        contentAlignment = Alignment.Center
    ) {
        if (!summary.hasData) {
            NoQadaView(context = context)
        } else {
            Column(
                modifier = GlanceModifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Title
                Text(
                    text = context.getString(R.string.widget_qada),
                    style = TextStyle(
                        color = NedaaColors.GlanceColors.primary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                )

                Spacer(modifier = GlanceModifier.height(8.dp))

                // Remaining count in a colored box
                Box(
                    modifier = GlanceModifier
                        .background(NedaaColors.GlanceColors.primaryBackground)
                        .cornerRadius(8.dp)
                        .padding(horizontal = 20.dp, vertical = 6.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "${summary.remaining}",
                        style = TextStyle(
                            color = NedaaColors.GlanceColors.primary,
                            fontSize = if (summary.remaining >= 100) 24.sp else 32.sp,
                            fontWeight = FontWeight.Bold
                        ),
                        maxLines = 1
                    )
                }

                Spacer(modifier = GlanceModifier.height(4.dp))

                Text(
                    text = context.getString(R.string.widget_remaining),
                    style = TextStyle(
                        color = NedaaColors.GlanceColors.textSecondary,
                        fontSize = 12.sp
                    )
                )

                // Today's completions and progress (stacked to prevent overflow on 2x2)
                Spacer(modifier = GlanceModifier.height(6.dp))

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    if (summary.todayCompleted > 0) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "+${summary.todayCompleted}",
                                style = TextStyle(
                                    color = NedaaColors.GlanceColors.success,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                            Spacer(modifier = GlanceModifier.width(4.dp))
                            Text(
                                text = "${summary.completionPercentage}%",
                                style = TextStyle(
                                    color = NedaaColors.GlanceColors.textSecondary,
                                    fontSize = 10.sp
                                )
                            )
                        }
                    } else {
                        Text(
                            text = "${summary.completionPercentage}%",
                            style = TextStyle(
                                color = NedaaColors.GlanceColors.textSecondary,
                                fontSize = 10.sp
                            )
                        )
                    }
                }
            }
        }
    }
}

/**
 * View when no Qada data exists
 */
@Composable
private fun NoQadaView(context: Context) {
    Column(
        modifier = GlanceModifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = context.getString(R.string.widget_qada),
            style = TextStyle(
                color = NedaaColors.GlanceColors.primary,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )
        )

        Spacer(modifier = GlanceModifier.height(8.dp))

        Text(
            text = "✓",
            style = TextStyle(
                color = NedaaColors.GlanceColors.success,
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold
            )
        )

        Spacer(modifier = GlanceModifier.height(4.dp))

        Text(
            text = context.getString(R.string.widget_no_qada),
            style = TextStyle(
                color = NedaaColors.GlanceColors.textSecondary,
                fontSize = 11.sp
            )
        )
    }
}
