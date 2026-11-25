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

    // Completed by a quiet or a solve, or its row deleted: every start is sent
    // for an alarm with a row, as AlarmReceiver checks.
    fun isEnded(completed: Boolean?): Boolean = completed != false

    // A redelivery of an ended alarm rings nothing.
    fun actionFor(redelivered: Boolean, ended: Boolean, ringing: Boolean): Action = when {
        !redelivered || !ended -> Action.RING
        ringing -> Action.SKIP
        else -> Action.SKIP_AND_STOP_THIS_START
    }
}
