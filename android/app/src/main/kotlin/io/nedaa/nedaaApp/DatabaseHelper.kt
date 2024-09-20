package io.nedaa.nedaaApp


import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONObject

// TODO: Better error handling(better?)
class DatabaseHelper(context: Context) :
    SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        private const val DATABASE_VERSION = 1
        private const val DATABASE_NAME = "nedaa.db"
        private const val TABLE_NAME = "PrayerTimes"
    }

    private lateinit var db: SQLiteDatabase


    override fun onCreate(db: SQLiteDatabase) {

    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {

    }

    fun openDatabase() {
        db = this.readableDatabase
    }


    fun getTimezone(): String? {
        val cursor = db.query(
            TABLE_NAME, // The table to query
            null, // The columns to return
            null, // The columns for the WHERE clause
            null, // The values for the WHERE clause
            null, // Don't group the rows
            null, // Don't filter by row groups
            null, // The sort order
            "1" // Limit to the first result
        )

        var timezone: String? = null
        if (cursor.moveToFirst()) {
            val json = cursor.getString(cursor.getColumnIndex("content"))
            val jsonObject = JSONObject(json)
            timezone = jsonObject.getString("timezone")
        }
        cursor.close()
        return timezone
    }

    fun getPrayerTimesForDate(date: Int): String? {
        val cursor = db.query(
            TABLE_NAME, // The table to query
            null, // The columns to return
            "date = ?", // The columns for the WHERE clause
            arrayOf(date.toString()), // The values for the WHERE clause
            null, // Don't group the rows
            null, // Don't filter by row groups
            null, // The sort order
            "1" // Limit to the first result
        )

        var json: String? = null
        if (cursor.moveToFirst()) {
            json = cursor.getString(cursor.getColumnIndex("content"))

        }
        cursor.close()
        return json
    }

    fun closeDatabase() {
        if (this::db.isInitialized && db.isOpen) {
            db.close()
            println("Database closed")
        }
    }
}