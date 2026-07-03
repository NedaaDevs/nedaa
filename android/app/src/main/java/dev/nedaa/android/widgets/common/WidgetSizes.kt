package dev.nedaa.android.widgets.common

import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp

/** Shared responsive breakpoints: compact (2×2), medium (4×2), wide (4×4), row (4×1). */
object WidgetSizes {
    val COMPACT = DpSize(110.dp, 110.dp)
    val MEDIUM = DpSize(250.dp, 110.dp)
    val WIDE = DpSize(250.dp, 250.dp)
    val ROW = DpSize(250.dp, 60.dp)
}
