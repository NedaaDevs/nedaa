package dev.nedaa.android.widgets.common

import android.os.Build
import androidx.compose.runtime.Composable
import androidx.glance.GlanceTheme
import androidx.glance.color.ColorProviders
import androidx.glance.color.colorProviders
import androidx.glance.color.ColorProvider as DayNightColorProvider

/** Material You dynamic color on Android 12+; NedaaColors-derived palette otherwise. All widgets wrap their content in this. */
@Composable
fun NedaaWidgetTheme(content: @Composable () -> Unit) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        GlanceTheme(content = content)
    } else {
        GlanceTheme(colors = nedaaColorProviders, content = content)
    }
}

// Maps every androidx.glance.color.ColorProviders slot to the nearest NedaaColors
// equivalent. Slots without a distinct NedaaColors value reuse the closest one.
private val nedaaColorProviders: ColorProviders = colorProviders(
    primary = NedaaColors.GlanceColors.primary,
    onPrimary = NedaaColors.GlanceColors.surface,
    primaryContainer = NedaaColors.GlanceColors.primaryBackground,
    onPrimaryContainer = NedaaColors.GlanceColors.primary,
    secondary = NedaaColors.GlanceColors.secondary,
    onSecondary = NedaaColors.GlanceColors.surface,
    secondaryContainer = NedaaColors.GlanceColors.primaryBackground,
    onSecondaryContainer = NedaaColors.GlanceColors.secondary,
    tertiary = NedaaColors.GlanceColors.tertiary,
    onTertiary = NedaaColors.GlanceColors.surface,
    tertiaryContainer = NedaaColors.GlanceColors.tertiary,
    onTertiaryContainer = NedaaColors.GlanceColors.text,
    error = DayNightColorProvider(NedaaColors.error, NedaaColors.error),
    errorContainer = DayNightColorProvider(NedaaColors.error, NedaaColors.error),
    onError = NedaaColors.GlanceColors.surface,
    onErrorContainer = NedaaColors.GlanceColors.text,
    background = NedaaColors.GlanceColors.background,
    onBackground = NedaaColors.GlanceColors.text,
    surface = NedaaColors.GlanceColors.surface,
    onSurface = NedaaColors.GlanceColors.text,
    surfaceVariant = NedaaColors.GlanceColors.background,
    onSurfaceVariant = NedaaColors.GlanceColors.textSecondary,
    outline = NedaaColors.GlanceColors.divider,
    inverseOnSurface = NedaaColors.GlanceColors.background,
    inverseSurface = NedaaColors.GlanceColors.text,
    inversePrimary = NedaaColors.GlanceColors.primary,
    widgetBackground = NedaaColors.GlanceColors.background,
)
