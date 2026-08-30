package dev.nedaa.android.widgets.notification

import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.LocalContext
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import dev.nedaa.android.R
import dev.nedaa.android.widgets.common.WidgetConfig
import dev.nedaa.android.widgets.data.DayPrayers
import dev.nedaa.android.widgets.data.PrayerData
import dev.nedaa.android.widgets.prayer.PrayerTimesContent
import dev.nedaa.android.widgets.prayer.WidgetSize
import dev.nedaa.android.widgets.prayer.getPrayerDisplayName
import dev.nedaa.android.widgets.prayer.isNextPrayer

/**
 * The collapsed state. Android gives a collapsed custom view as little as 48dp, so this packs
 * all five prayers into two short text lines and carries no header of its own.
 */
@Composable
fun PrayerNotificationCompact(
    dayPrayers: DayPrayers?,
    nextPrayer: PrayerData?,
    config: WidgetConfig
) {
    val context = config.localizedContext(LocalContext.current)
    val prayers = dayPrayers?.prayers.orEmpty()
    val timezone = dayPrayers?.getTimezoneObj()

    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .background(GlanceTheme.colors.background)
            .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (prayers.isEmpty() || timezone == null) {
            Text(
                text = context.getString(R.string.widget_no_data),
                style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant, fontSize = 12.sp),
                maxLines = 1
            )
        } else {
            prayers.forEach { prayer ->
                val isNext = isNextPrayer(prayer, nextPrayer)

                Column(
                    modifier = GlanceModifier.defaultWeight().padding(horizontal = 2.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = getPrayerDisplayName(prayer.name, context),
                        style = TextStyle(
                            color = if (isNext) {
                                GlanceTheme.colors.primary
                            } else {
                                GlanceTheme.colors.onSurfaceVariant
                            },
                            fontSize = 10.sp,
                            fontWeight = if (isNext) FontWeight.Bold else FontWeight.Normal
                        ),
                        maxLines = 1
                    )
                    Text(
                        text = config.localizeNumber(
                            prayer.formatTime12Hour(timezone, config.locale)
                        ),
                        style = TextStyle(
                            color = if (isNext) {
                                GlanceTheme.colors.primary
                            } else {
                                GlanceTheme.colors.onBackground
                            },
                            fontSize = 12.sp,
                            fontWeight = if (isNext) FontWeight.Bold else FontWeight.Medium
                        ),
                        maxLines = 1
                    )
                }
            }
        }
    }
}

/** The expanded state delegates the five-prayer row and highlight behavior to the widget. */
@Composable
fun PrayerNotificationExpanded(
    dayPrayers: DayPrayers?,
    nextPrayer: PrayerData?,
    config: WidgetConfig
) {
    PrayerTimesContent(
        dayPrayers = dayPrayers,
        nextPrayer = nextPrayer,
        previousPrayer = null,
        widgetSize = WidgetSize.MEDIUM,
        config = config,
        modifier = GlanceModifier.fillMaxWidth()
    )
}
