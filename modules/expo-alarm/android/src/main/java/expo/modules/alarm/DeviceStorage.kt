package expo.modules.alarm

import android.content.Context
import android.os.UserManager

/**
 * Alarm state lives in device-protected storage: after a reboot, alarms are restored and
 * ring before the first unlock, when credential-encrypted storage cannot be read.
 */
object DeviceStorage {
    fun context(context: Context): Context =
        (context.applicationContext ?: context).createDeviceProtectedStorageContext()

    /** Moves data written to credential-encrypted storage by earlier versions, once unlocked. */
    fun migrate(context: Context, databaseName: String? = null, preferencesName: String? = null) {
        val appContext = context.applicationContext ?: context
        val unlocked = appContext.getSystemService(UserManager::class.java)?.isUserUnlocked ?: true
        if (!unlocked) return
        val target = context(appContext)
        if (databaseName != null && appContext.getDatabasePath(databaseName).exists()) {
            target.moveDatabaseFrom(appContext, databaseName)
        }
        if (preferencesName != null) {
            target.moveSharedPreferencesFrom(appContext, preferencesName)
        }
    }
}
