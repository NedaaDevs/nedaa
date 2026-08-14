package expo.modules.diagnostics

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri

// Installs the uncaught-exception handler at process start. A ContentProvider is the
// earliest hook a library can claim without owning the Application class, and it runs on
// every process launch — including launches made only for a broadcast or a widget update,
// where no React context exists and an Expo module never initializes. It holds no data;
// the CRUD methods exist because the base class requires them.
class DiagnosticsInitProvider : ContentProvider() {
  override fun onCreate(): Boolean {
    context?.let { JvmCrashRecorder.install(it) }
    return true
  }

  override fun query(
    uri: Uri,
    projection: Array<out String>?,
    selection: String?,
    selectionArgs: Array<out String>?,
    sortOrder: String?
  ): Cursor? = null

  override fun getType(uri: Uri): String? = null

  override fun insert(uri: Uri, values: ContentValues?): Uri? = null

  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0

  override fun update(
    uri: Uri,
    values: ContentValues?,
    selection: String?,
    selectionArgs: Array<out String>?
  ): Int = 0
}
