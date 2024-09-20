package io.nedaa.nedaaApp

import android.app.AlarmManager
import android.content.Context
import android.os.Build
import androidx.core.content.ContextCompat

object PermissionUtil {
    fun canScheduleExactAlarms(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = ContextCompat.getSystemService(context, AlarmManager::class.java)
            alarmManager?.canScheduleExactAlarms() ?: false
        } else {
            true
        }
    }
}