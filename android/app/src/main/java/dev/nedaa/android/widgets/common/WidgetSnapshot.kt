package dev.nedaa.android.widgets.common

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.io.File
import java.util.Calendar
import java.util.TimeZone

data class SnapshotConfig(val useWesternNumerals: Boolean, val timezone: String, val hijriDaysOffset: Int)
data class SnapshotDay(val date: Int, val timings: JSONObject, val otherTimings: JSONObject)
data class SnapshotPrayerTimes(val timezone: String, val days: List<SnapshotDay>)
data class SnapshotHijriToday(val date: Int, val hijriLabel: String)
data class SnapshotImportantDay(val id: String, val name: String, val hijriLabel: String, val dateISO: String)
data class SnapshotSession(val completed: Int, val total: Int, val completedAt: String?)
data class SnapshotStreak(val current: Int, val longest: Int)
data class SnapshotAthkar(
    val date: Int,
    val morning: SnapshotSession,
    val evening: SnapshotSession,
    val streak: SnapshotStreak,
)
data class SnapshotQada(val date: Int, val totalMissed: Int, val totalCompleted: Int, val completedToday: Int)

/**
 * The document JS writes for the widgets. Every group is nullable: a document missing one
 * group still serves the others, and each reader falls back on its own.
 */
data class Snapshot(
    val writtenAt: Long,
    val config: SnapshotConfig?,
    val prayerTimes: SnapshotPrayerTimes?,
    val hijriToday: SnapshotHijriToday?,
    val importantDays: List<SnapshotImportantDay>?,
    val athkar: SnapshotAthkar?,
    val qada: SnapshotQada?,
)

/**
 * The only way widget code reads app data. JS writes `files/widgets/snapshot.json` through
 * expo-sqlite's own connection, so no second SQLite library ever opens the databases
 * from this process — that second attacher is what truncated the WAL index under a live
 * mapping.
 */
object WidgetSnapshot {
    const val VERSION = 1
    private const val TAG = "WidgetSnapshot"
    private const val DIR = "widgets"
    private const val FILE = "snapshot.json"

    fun load(context: Context): Snapshot? {
        val file = File(File(context.filesDir, DIR), FILE)
        if (!file.exists()) return null
        return try {
            parse(file.readText())
        } catch (e: Exception) {
            Log.w(TAG, "snapshot unreadable", e)
            null
        }
    }

    /** Null for anything that is not a complete document of the known version. */
    internal fun parse(json: String): Snapshot? {
        val root = try {
            JSONObject(json)
        } catch (_: JSONException) {
            return null
        }
        if (root.optInt("version", -1) != VERSION) return null
        return Snapshot(
            writtenAt = root.optLong("writtenAt", 0L),
            config = root.optJSONObject("config")?.let {
                SnapshotConfig(
                    useWesternNumerals = it.optBoolean("useWesternNumerals", false),
                    timezone = it.optString("timezone", ""),
                    hijriDaysOffset = it.optInt("hijriDaysOffset", 0),
                )
            },
            prayerTimes = root.optJSONObject("prayerTimes")?.let { p ->
                SnapshotPrayerTimes(
                    timezone = p.optString("timezone", ""),
                    days = objects(p.optJSONArray("days")).mapNotNull { d ->
                        val timings = d.optJSONObject("timings") ?: return@mapNotNull null
                        SnapshotDay(d.optInt("date", 0), timings, d.optJSONObject("otherTimings") ?: JSONObject())
                    },
                )
            },
            hijriToday = root.optJSONObject("hijriToday")?.let {
                SnapshotHijriToday(it.optInt("date", 0), it.optString("hijriLabel", ""))
            },
            importantDays = root.optJSONArray("importantDays")?.let { arr ->
                objects(arr).map {
                    SnapshotImportantDay(
                        it.optString("id", ""),
                        it.optString("name", ""),
                        it.optString("hijriLabel", ""),
                        it.optString("dateISO", ""),
                    )
                }
            },
            athkar = root.optJSONObject("athkar")?.let { a ->
                val streak = a.optJSONObject("streak")
                SnapshotAthkar(
                    date = a.optInt("date", 0),
                    morning = session(a.optJSONObject("morning")),
                    evening = session(a.optJSONObject("evening")),
                    streak = SnapshotStreak(streak?.optInt("current", 0) ?: 0, streak?.optInt("longest", 0) ?: 0),
                )
            },
            qada = root.optJSONObject("qada")?.let {
                SnapshotQada(
                    it.optInt("date", 0),
                    it.optInt("totalMissed", 0),
                    it.optInt("totalCompleted", 0),
                    it.optInt("completedToday", 0),
                )
            },
        )
    }

    /** YYYYMMDD for the instant in the zone, matching JS's `dateToInt(toZonedTime(...))`. */
    internal fun dateIntFor(nowMillis: Long, tz: TimeZone): Int {
        val c = Calendar.getInstance(tz).apply { timeInMillis = nowMillis }
        return c.get(Calendar.YEAR) * 10000 + (c.get(Calendar.MONTH) + 1) * 100 + c.get(Calendar.DAY_OF_MONTH)
    }

    private fun objects(arr: JSONArray?): List<JSONObject> =
        if (arr == null) emptyList() else (0 until arr.length()).mapNotNull { arr.optJSONObject(it) }

    // optString turns a JSON null into the text "null"; isNull is the only honest check.
    private fun session(o: JSONObject?): SnapshotSession = SnapshotSession(
        completed = o?.optInt("completed", 0) ?: 0,
        total = o?.optInt("total", 0) ?: 0,
        completedAt = o?.takeUnless { it.isNull("completedAt") }?.optString("completedAt"),
    )
}
