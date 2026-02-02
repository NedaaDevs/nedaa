package expo.modules.alarm

import android.content.Context
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.CopyOnWriteArrayList

class AlarmLogger private constructor(private val context: Context) {

    companion object {
        private const val TAG = "AlarmLogger"
        private const val MAX_ENTRIES = 500
        private const val LOG_FILE_NAME = "alarm_debug.log"

        @Volatile
        private var instance: AlarmLogger? = null

        fun getInstance(context: Context): AlarmLogger {
            return instance ?: synchronized(this) {
                instance ?: AlarmLogger(context.applicationContext).also { instance = it }
            }
        }
    }

    private val logs = CopyOnWriteArrayList<LogEntry>()
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US)

    data class LogEntry(
        val timestamp: Long,
        val level: String,
        val tag: String,
        val message: String
    ) {
        fun toMap(): Map<String, Any> = mapOf(
            "timestamp" to timestamp,
            "level" to level,
            "tag" to tag,
            "message" to message
        )

        fun format(dateFormat: SimpleDateFormat): String {
            return "${dateFormat.format(Date(timestamp))} [$level] $tag: $message"
        }
    }

    fun d(tag: String, message: String) {
        addLog("DEBUG", tag, message)
        Log.d(tag, message)
    }

    fun i(tag: String, message: String) {
        addLog("INFO", tag, message)
        Log.i(tag, message)
    }

    fun w(tag: String, message: String) {
        addLog("WARN", tag, message)
        Log.w(tag, message)
    }

    fun e(tag: String, message: String, throwable: Throwable? = null) {
        val fullMessage = if (throwable != null) {
            "$message: ${throwable.message}\n${throwable.stackTraceToString()}"
        } else {
            message
        }
        addLog("ERROR", tag, fullMessage)
        Log.e(tag, message, throwable)
    }

    private fun addLog(level: String, tag: String, message: String) {
        val entry = LogEntry(System.currentTimeMillis(), level, tag, message)
        logs.add(entry)

        // Trim old entries
        while (logs.size > MAX_ENTRIES) {
            logs.removeAt(0)
        }

        // Also append to file for persistence across crashes
        appendToFile(entry)
    }

    private fun appendToFile(entry: LogEntry) {
        try {
            val file = File(context.filesDir, LOG_FILE_NAME)
            file.appendText(entry.format(dateFormat) + "\n")

            // Trim file if too large (> 100KB)
            if (file.length() > 100 * 1024) {
                val lines = file.readLines().takeLast(MAX_ENTRIES)
                file.writeText(lines.joinToString("\n") + "\n")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to write log file: ${e.message}")
        }
    }

    fun getLogs(): List<Map<String, Any>> {
        return logs.map { it.toMap() }
    }

    fun getLogsAsString(): String {
        return logs.joinToString("\n") { it.format(dateFormat) }
    }

    fun getFullLog(): String {
        val memoryLogs = getLogsAsString()
        val fileLogs = try {
            val file = File(context.filesDir, LOG_FILE_NAME)
            if (file.exists()) file.readText() else ""
        } catch (e: Exception) {
            "Error reading log file: ${e.message}"
        }

        return buildString {
            appendLine("=== ALARM DEBUG LOG ===")
            appendLine("Generated: ${dateFormat.format(Date())}")
            appendLine()
            appendLine("--- File Log (persistent) ---")
            appendLine(fileLogs)
            appendLine()
            appendLine("--- Memory Log (session) ---")
            appendLine(memoryLogs)
        }
    }

    fun clear() {
        logs.clear()
        try {
            val file = File(context.filesDir, LOG_FILE_NAME)
            if (file.exists()) file.delete()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete log file: ${e.message}")
        }
    }
}
