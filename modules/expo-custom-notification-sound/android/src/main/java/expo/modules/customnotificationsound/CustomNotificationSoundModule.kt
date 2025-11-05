package expo.modules.customnotificationsound

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ContentValues
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.OutputStream

class CustomNotificationSoundModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CustomNotificationSound")

    // Register a sound file with MediaStore and return its content:// URI
    AsyncFunction("registerSoundFile") { filePath: String, title: String, promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("Context not available")
        val file = File(filePath)

        if (!file.exists()) {
          promise.reject("FILE_NOT_FOUND", "Sound file not found at path: $filePath", null)
          return@AsyncFunction
        }

        // Prepare content values for MediaStore
        val values = ContentValues().apply {
          put(MediaStore.MediaColumns.DISPLAY_NAME, title)
          put(MediaStore.MediaColumns.MIME_TYPE, getMimeType(filePath))
          put(MediaStore.Audio.Media.IS_NOTIFICATION, true)
          put(MediaStore.Audio.Media.IS_RINGTONE, false)
          put(MediaStore.Audio.Media.IS_ALARM, false)
          put(MediaStore.Audio.Media.IS_MUSIC, false)

          // For Android 10+, use relative path
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            put(MediaStore.MediaColumns.RELATIVE_PATH, "Notifications/Nedaa")
          }
        }

        // Insert into MediaStore
        val contentUri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        } else {
          MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        }

        // Check if already exists and delete
        val existingUri = findExistingSoundByTitle(context, title)
        if (existingUri != null) {
          context.contentResolver.delete(existingUri, null, null)
        }

        val uri = context.contentResolver.insert(contentUri, values)

        if (uri == null) {
          promise.reject("INSERT_FAILED", "Failed to insert sound into MediaStore", null)
          return@AsyncFunction
        }

        // Copy file content to the new MediaStore entry
        try {
          context.contentResolver.openOutputStream(uri)?.use { outputStream ->
            FileInputStream(file).use { inputStream ->
              inputStream.copyTo(outputStream)
            }
          }
        } catch (e: Exception) {
          // Clean up the MediaStore entry if copy fails
          context.contentResolver.delete(uri, null, null)
          promise.reject("COPY_FAILED", "Failed to copy file content: ${e.message}", e)
          return@AsyncFunction
        }

        promise.resolve(uri.toString())
      } catch (e: Exception) {
        promise.reject("REGISTER_ERROR", "Error registering sound file: ${e.message}", e)
      }
    }

    // Create a notification channel with custom sound URI
    AsyncFunction("createChannelWithCustomSound") {
      channelId: String,
      channelName: String,
      soundUriString: String,
      importance: Int,
      vibration: Boolean,
      promise: Promise ->

      try {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
          promise.reject("VERSION_ERROR", "Notification channels require Android O (API 26) or higher", null)
          return@AsyncFunction
        }

        val context = appContext.reactContext ?: throw Exception("Context not available")
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Delete existing channel if it exists (required to change sound)
        notificationManager.deleteNotificationChannel(channelId)

        val soundUri = Uri.parse(soundUriString)
        val audioAttributes = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()

        val channel = NotificationChannel(channelId, channelName, importance).apply {
          setSound(soundUri, audioAttributes)
          enableVibration(vibration)
          if (vibration) {
            vibrationPattern = longArrayOf(0, 250, 250, 250)
          }
          setShowBadge(true)
        }

        notificationManager.createNotificationChannel(channel)
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("CHANNEL_ERROR", "Error creating notification channel: ${e.message}", e)
      }
    }

    // Delete custom sound from MediaStore
    AsyncFunction("deleteCustomSound") { contentUriString: String, promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("Context not available")
        val uri = Uri.parse(contentUriString)

        val deletedRows = context.contentResolver.delete(uri, null, null)

        if (deletedRows > 0) {
          promise.resolve(true)
        } else {
          promise.reject("DELETE_FAILED", "No sound found to delete", null)
        }
      } catch (e: Exception) {
        promise.reject("DELETE_ERROR", "Error deleting sound: ${e.message}", e)
      }
    }

    // Check if a custom sound URI is still valid
    AsyncFunction("isCustomSoundValid") { contentUriString: String, promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("Context not available")
        val uri = Uri.parse(contentUriString)

        val cursor = context.contentResolver.query(
          uri,
          arrayOf(MediaStore.MediaColumns._ID),
          null,
          null,
          null
        )

        val isValid = cursor?.use { it.count > 0 } ?: false
        promise.resolve(isValid)
      } catch (e: Exception) {
        promise.resolve(false)
      }
    }
  }

  // Helper function to get MIME type from file path
  private fun getMimeType(filePath: String): String {
    return when {
      filePath.endsWith(".ogg", ignoreCase = true) -> "audio/ogg"
      filePath.endsWith(".mp3", ignoreCase = true) -> "audio/mpeg"
      filePath.endsWith(".wav", ignoreCase = true) -> "audio/wav"
      filePath.endsWith(".m4a", ignoreCase = true) -> "audio/mp4"
      filePath.endsWith(".aac", ignoreCase = true) -> "audio/aac"
      else -> "audio/*"
    }
  }

  // Helper function to find existing sound by title
  private fun findExistingSoundByTitle(context: Context, title: String): Uri? {
    val projection = arrayOf(MediaStore.MediaColumns._ID)
    val selection = "${MediaStore.MediaColumns.DISPLAY_NAME} = ?"
    val selectionArgs = arrayOf(title)

    val cursor = context.contentResolver.query(
      MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
      projection,
      selection,
      selectionArgs,
      null
    )

    return cursor?.use {
      if (it.moveToFirst()) {
        val id = it.getLong(it.getColumnIndexOrThrow(MediaStore.MediaColumns._ID))
        Uri.withAppendedPath(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id.toString())
      } else {
        null
      }
    }
  }
}
