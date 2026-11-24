package expo.modules.alarm

// What AlarmService does with a start, the system's redelivery after a kill included.
object RedeliveredStart {

    enum class Action {
        RING,
        // A ring in progress keeps the service and its notice.
        SKIP,
        // Only this start ends, so a later queued start still rings.
        SKIP_AND_STOP_THIS_START,
    }

    // A quiet or a solve marked the alarm completed, so its redelivery rings nothing.
    fun actionFor(redelivered: Boolean, completed: Boolean?, ringing: Boolean): Action = when {
        !redelivered || completed != true -> Action.RING
        ringing -> Action.SKIP
        else -> Action.SKIP_AND_STOP_THIS_START
    }
}
