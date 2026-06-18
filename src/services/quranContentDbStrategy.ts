// Decisions for the content-DB open path, kept pure so the open/update flow in
// quran-content-db.ts stays testable without native SQLite/filesystem/network.

// Block the reader on a download only when there is no usable installed DB. When
// the DB file is present AND stamped with a version, open it immediately and
// defer the manifest/version check to the background (so cold opens don't wait on
// the network for a DB they already have).
export const mustDownloadBeforeOpen = (
  dbExists: boolean,
  installedVersion: string | null
): boolean => !dbExists || installedVersion === null;

// A background update is warranted only when an installed version is known and
// the manifest advertises a different one. Missing manifest (offline) or missing
// install (handled by the blocking path) is never an update.
export const needsContentUpdate = (
  installedVersion: string | null,
  manifestVersion: string | null
): boolean =>
  installedVersion !== null && manifestVersion !== null && installedVersion !== manifestVersion;
