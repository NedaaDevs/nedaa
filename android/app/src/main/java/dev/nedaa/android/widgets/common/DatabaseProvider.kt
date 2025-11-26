package dev.nedaa.android.widgets.common

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.util.Log
import java.io.File

/**
 * Provides access to SQLite databases created by App
 * Handles database path discovery for both standard and Expo SQLite locations
 */
object DatabaseProvider {
    private const val TAG = "DatabaseProvider"
    private const val NEDAA_DB = "nedaa.db"
    private const val ATHKAR_DB = "athkar.db"

    /**
     * Get read-only access to the Nedaa database (prayer times, qada)
     */
    fun getNedaaDatabase(context: Context): SQLiteDatabase? {
        return openDatabase(context, NEDAA_DB)
    }

    /**
     * Get read-only access to the Athkar database
     */
    fun getAthkarDatabase(context: Context): SQLiteDatabase? {
        return openDatabase(context, ATHKAR_DB)
    }

    /**
     * Open a database by name, checking multiple possible locations
     */
    private fun openDatabase(context: Context, dbName: String): SQLiteDatabase? {
        val dbPath = findDatabasePath(context, dbName)

        if (dbPath == null) {
            Log.w(TAG, "Database not found: $dbName")
            return null
        }

        return try {
            SQLiteDatabase.openDatabase(
                dbPath,
                null,
                SQLiteDatabase.OPEN_READONLY
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error opening database: $dbName", e)
            null
        }
    }

    /**
     * Find the database path, checking multiple possible locations
     * Expo SQLite stores databases in /data/data/<package>/files/SQLite/
     */
    private fun findDatabasePath(context: Context, dbName: String): String? {
        // Possible database locations in order of preference
        val possiblePaths = listOf(
            // Expo SQLite default location: files/SQLite/dbname.db
            File(context.filesDir, "SQLite/$dbName"),
            // Alternative: files/SQLite/dbname (without extension check)
            File(context.filesDir, "SQLite/${dbName.removeSuffix(".db")}"),
            // Standard Android databases folder
            context.getDatabasePath(dbName),
            // Alternative Expo location
            File(context.filesDir, "databases/$dbName"),
            // Direct files folder
            File(context.filesDir, dbName),
            // ExpoSQLite might also use this path
            File(context.noBackupFilesDir, "SQLite/$dbName")
        )

        for (path in possiblePaths) {
            Log.d(TAG, "Checking path: ${path.absolutePath} (exists: ${path.exists()}, canRead: ${path.canRead()})")
            if (path.exists() && path.canRead()) {
                Log.d(TAG, "Found database at: ${path.absolutePath}")
                return path.absolutePath
            }
        }

        // Also log the SQLite directory contents if it exists
        val sqliteDir = File(context.filesDir, "SQLite")
        if (sqliteDir.exists() && sqliteDir.isDirectory) {
            Log.d(TAG, "SQLite directory contents: ${sqliteDir.listFiles()?.map { it.name }}")
        } else {
            Log.w(TAG, "SQLite directory does not exist: ${sqliteDir.absolutePath}")
        }

        Log.w(TAG, "Database not found in any location: $dbName")
        return null
    }

    /**
     * Check if the Nedaa database exists and is accessible
     */
    fun isNedaaDatabaseAvailable(context: Context): Boolean {
        return findDatabasePath(context, NEDAA_DB) != null
    }

    /**
     * Check if the Athkar database exists and is accessible
     */
    fun isAthkarDatabaseAvailable(context: Context): Boolean {
        return findDatabasePath(context, ATHKAR_DB) != null
    }
}
