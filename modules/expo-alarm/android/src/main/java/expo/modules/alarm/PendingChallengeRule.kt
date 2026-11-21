package expo.modules.alarm

// Whether a pending challenge still owns the ring, so a second alarm waits.
object PendingChallengeRule {

    // Matches ALARM_DEFAULTS.STALE_ALARM_THRESHOLD_MS on the JS side.
    const val STALE_PENDING_MS = 2 * 60 * 60 * 1000L

    // A row the service is ringing stays open at any age: a ring has no limit.
    // Same rule as the JS endsByAge; stale-rule.tsv pins both.
    fun isOpen(completed: Boolean?, pendingAlarmId: String, ringingAlarmId: String?, ageMs: Long): Boolean {
        if (completed != false) return false
        return pendingAlarmId == ringingAlarmId || ageMs <= STALE_PENDING_MS
    }
}
