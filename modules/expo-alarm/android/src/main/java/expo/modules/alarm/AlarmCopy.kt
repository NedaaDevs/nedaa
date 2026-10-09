package expo.modules.alarm

import android.content.Context

/**
 * Text shown while an alarm rings, in the app's language. JS saves it at launch and on
 * every language change; the English fallback covers the time before the first save.
 */
object AlarmCopy {
    private const val PREFS_NAME = "alarm_copy"

    fun save(context: Context, copy: Map<String, String>) {
        val editor = prefs(context).edit().clear()
        copy.forEach { (field, value) -> editor.putString(field, value) }
        editor.apply()
    }

    fun text(context: Context, field: String, fallback: String): String =
        prefs(context).getString(field, null)?.takeIf { it.isNotEmpty() } ?: fallback

    fun snoozedTitle(context: Context, title: String, count: Int, max: Int): String =
        fillSnoozedTitle(snoozedTemplate(context), title, count, max)

    /** Fills a template whose placeholders match SNOOZE_TOKEN in JS. */
    internal fun fillSnoozedTitle(template: String, title: String, count: Int, max: Int): String =
        template
            .replace("{title}", stripSnoozed(template, title))
            .replace("{count}", count.toString())
            .replace("{max}", max.toString())

    /** Removes a snoozed suffix the template already added, so a second snooze does not repeat it. */
    internal fun stripSnoozed(template: String, title: String): String {
        val parts = template.split("{title}")
        if (parts.size != 2) return title
        val (before, after) = parts.map { Regex.escape(it).toCountPattern() }
        return Regex("^$before(.*?)$after$").find(title)?.groupValues?.get(1) ?: title
    }

    private fun String.toCountPattern(): String =
        replace("{count}", "\\E\\d+\\Q").replace("{max}", "\\E\\d+\\Q")

    private fun snoozedTemplate(context: Context): String =
        text(context, "snoozedTitle", "{title} (Snoozed {count}/{max})")

    private fun prefs(context: Context) =
        DeviceStorage.context(context).getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
