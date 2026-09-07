package dev.nedaa.android.widgets.data

import android.content.Context
import dev.nedaa.android.widgets.athkar.ATHKAR_SESSION_MORNING
import dev.nedaa.android.widgets.common.Snapshot
import dev.nedaa.android.widgets.common.SnapshotAthkar
import dev.nedaa.android.widgets.common.WidgetSnapshot
import java.util.TimeZone

/** Athkar progress for the widgets, read from the snapshot JS writes. */
class AthkarDataService(private val context: Context) {

    companion object {
        /**
         * Today's progress resets at midnight; the streak and the per-session totals are the
         * last known values. A stale day therefore reads as 0/total, never as yesterday's count.
         */
        internal fun summaryFrom(athkar: SnapshotAthkar?, today: Int): AthkarSummary {
            if (athkar == null) return AthkarSummary.empty()
            val fresh = athkar.date == today
            val morningDone = fresh && athkar.morning.completedAt != null
            val eveningDone = fresh && athkar.evening.completedAt != null
            return AthkarSummary(
                morningCompleted = morningDone,
                eveningCompleted = eveningDone,
                currentStreak = athkar.streak.current,
                longestStreak = athkar.streak.longest,
                completedItems = if (fresh) athkar.morning.completed + athkar.evening.completed else 0,
                totalItems = athkar.morning.total + athkar.evening.total,
            )
        }

        /** Completed/total for one session (`morning` / `evening`) today. */
        internal fun sessionFrom(athkar: SnapshotAthkar?, today: Int, session: String): Pair<Int, Int> {
            if (athkar == null) return Pair(0, 0)
            val s = if (session == ATHKAR_SESSION_MORNING) athkar.morning else athkar.evening
            return if (athkar.date == today) Pair(s.completed, s.total) else Pair(0, s.total)
        }
    }

    private val snapshot: Snapshot? by lazy { WidgetSnapshot.load(context) }

    // The app keys athkar days to the location zone, which the snapshot carries in config.
    private fun today(): Int {
        val zone = snapshot?.config?.timezone?.takeIf { it.isNotEmpty() }?.let { TimeZone.getTimeZone(it) }
            ?: TimeZone.getDefault()
        return WidgetSnapshot.dateIntFor(System.currentTimeMillis(), zone)
    }

    fun getAthkarSummary(): AthkarSummary = summaryFrom(snapshot?.athkar, today())

    fun isMorningCompleted(): Boolean = getAthkarSummary().morningCompleted

    fun isEveningCompleted(): Boolean = getAthkarSummary().eveningCompleted

    fun sessionProgress(session: String): Pair<Int, Int> = sessionFrom(snapshot?.athkar, today(), session)
}
