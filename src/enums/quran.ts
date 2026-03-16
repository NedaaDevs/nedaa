export enum MushafVersion {
  V1 = "v1",
  V2 = "v2",
  V4 = "v4",
}

export enum QuranTheme {
  LIGHT = "light",
  SEPIA = "sepia",
  DARK = "dark",
}

export enum LineType {
  TEXT = "text",
  SURAH_HEADER = "surah-header",
  BASMALA = "basmala",
  EMPTY = "empty",
}

export enum DownloadStatus {
  IDLE = "idle",
  DOWNLOADING = "downloading",
  PAUSED = "paused",
  COMPLETE = "complete",
  ERROR = "error",
}

export enum PageDownloadStatus {
  PENDING = "pending",
  DOWNLOADING = "downloading",
  COMPLETE = "complete",
  FAILED = "failed",
}
