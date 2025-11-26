package dev.nedaa.android.widgets.common

import androidx.compose.ui.graphics.Color
import androidx.glance.color.ColorProvider

/**
 * Color theme.
 * Used across all widgets for consistent theming
 */
object NedaaColors {

    // Light Theme Colors
    object Light {
        val primary = Color(0xFF1C5D85)      // Deep blue
        val secondary = Color(0xFF1C5D7D)
        val tertiary = Color(0xFF2A4D6D)     // Darker blue-gray
        val background = Color(0xFFF5F7FA)   // Light gray-blue
        val surface = Color.White
        val text = Color(0xFF1C1B1F)
        val textSecondary = Color(0xFF49454F)
        val success = Color(0xFF4CAF50)
        val primaryBackground = Color(0x261C5D85)  // primary with 15% opacity
        val successBackground = Color(0x154CAF50)  // success with 8% opacity
        val divider = Color(0x4D49454F)      // textSecondary with 30% opacity
    }

    // Dark Theme Colors
    object Dark {
        val primary = Color(0xFFE6C469)      // Golden/amber
        val secondary = Color(0xFFD4BA76)    // Muted gold
        val tertiary = Color(0xFF393E46)     // Dark blue-gray
        val background = Color(0xFF222831)   // Very dark blue-gray
        val surface = Color(0xFF393E46)
        val text = Color.White
        val textSecondary = Color.Gray
        val success = Color(0xFF4CAF50)
        val primaryBackground = Color(0x26E6C469)  // primary with 15% opacity
        val successBackground = Color(0x154CAF50)  // success with 8% opacity
        val divider = Color(0x4D808080)      // gray with 30% opacity
    }

    // Status Colors (same in both themes)
    val success = Color(0xFF4CAF50)
    val warning = Color(0xFFFF9800)
    val error = Color(0xFFF44336)
    val info = Color(0xFF2196F3)

    // Glance ColorProviders for automatic light/dark switching
    object GlanceColors {
        val primary = ColorProvider(Light.primary, Dark.primary)
        val secondary = ColorProvider(Light.secondary, Dark.secondary)
        val tertiary = ColorProvider(Light.tertiary, Dark.tertiary)
        val background = ColorProvider(Light.background, Dark.background)
        val surface = ColorProvider(Light.surface, Dark.surface)
        val text = ColorProvider(Light.text, Dark.text)
        val textSecondary = ColorProvider(Light.textSecondary, Dark.textSecondary)
        val success = ColorProvider(Light.success, Dark.success)
        val primaryBackground = ColorProvider(Light.primaryBackground, Dark.primaryBackground)
        val successBackground = ColorProvider(Light.successBackground, Dark.successBackground)
        val divider = ColorProvider(Light.divider, Dark.divider)
    }
}
