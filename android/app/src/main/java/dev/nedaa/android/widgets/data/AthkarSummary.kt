package dev.nedaa.android.widgets.data

/**
 * Summary of daily Athkar (remembrance) progress
 */
data class AthkarSummary(
    val morningCompleted: Boolean,
    val eveningCompleted: Boolean,
    val currentStreak: Int,
    val longestStreak: Int,
    val completedItems: Int,
    val totalItems: Int
) {
    /**
     * Progress percentage (0-100)
     */
    val progressPercentage: Int
        get() = if (totalItems > 0) (completedItems * 100) / totalItems else 0

    /**
     * Progress as a fraction (0.0-1.0)
     */
    val progressFraction: Float
        get() = if (totalItems > 0) completedItems.toFloat() / totalItems else 0f

    /**
     * Check if both morning and evening athkar are completed
     */
    val isFullyCompleted: Boolean
        get() = morningCompleted && eveningCompleted

    /**
     * Check if any athkar is completed today
     */
    val hasAnyCompletion: Boolean
        get() = morningCompleted || eveningCompleted

    companion object {
        /**
         * Create an empty summary when no data is available
         */
        fun empty() = AthkarSummary(
            morningCompleted = false,
            eveningCompleted = false,
            currentStreak = 0,
            longestStreak = 0,
            completedItems = 0,
            totalItems = 0
        )
    }
}
