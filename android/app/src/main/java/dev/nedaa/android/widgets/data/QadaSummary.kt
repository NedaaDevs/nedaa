package dev.nedaa.android.widgets.data

/**
 * Summary of Qada (missed fasts) tracking
 */
data class QadaSummary(
    val totalMissed: Int,
    val totalCompleted: Int,
    val todayCompleted: Int
) {
    /**
     * Total fasts (missed + completed)
     */
    val totalFasts: Int
        get() = totalMissed + totalCompleted

    /**
     * Remaining fasts to make up
     */
    val remaining: Int
        get() = totalMissed

    /**
     * Completion percentage (0-100)
     */
    val completionPercentage: Int
        get() = if (totalFasts > 0) (totalCompleted * 100) / totalFasts else 0

    /**
     * Completion as a fraction (0.0-1.0)
     */
    val completionFraction: Float
        get() = if (totalFasts > 0) totalCompleted.toFloat() / totalFasts else 0f

    /**
     * Check if all fasts have been made up
     */
    val isComplete: Boolean
        get() = totalMissed == 0 && totalCompleted > 0

    /**
     * Check if there are any fasts to track
     */
    val hasData: Boolean
        get() = totalFasts > 0

    companion object {
        /**
         * Create an empty summary when no data is available
         */
        fun empty() = QadaSummary(
            totalMissed = 0,
            totalCompleted = 0,
            todayCompleted = 0
        )
    }
}
