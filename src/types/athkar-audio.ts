import { PLAYBACK_MODE, REPEAT_LIMIT_OPTIONS } from "@/constants/AthkarAudio";

// Playback mode
export type PlaybackMode = (typeof PLAYBACK_MODE)[keyof typeof PLAYBACK_MODE];

// Repeat limit
export type RepeatLimit = (typeof REPEAT_LIMIT_OPTIONS)[number]["value"];

// Player state — no more crossfading
export type PlayerState = "idle" | "loading" | "playing" | "paused" | "ended";

// Download status
export type DownloadStatus = "pending" | "downloading" | "complete" | "failed";

// Reciter catalog entry (from API) — UNCHANGED
export type ReciterCatalogEntry = {
  id: string;
  name: Record<string, string>;
  avatar: string;
  type: "clips" | "session" | "hybrid";
  totalSize: number;
  thikrCount: number;
  sampleUrl: string;
  manifestUrl: string;
  isDefault: boolean;
};

// Reciter catalog (from API) — UNCHANGED
export type ReciterCatalog = {
  version: number;
  reciters: ReciterCatalogEntry[];
};

// Audio file entry in manifest — UNCHANGED
export type AudioFileEntry = {
  url: string;
  duration: number;
  size: number;
};

// Session marker for full session recordings — UNCHANGED
export type SessionMarker = {
  thikrId: string;
  start: number;
  end: number;
  totalCount: number;
};

// Session file entry — UNCHANGED
export type SessionFileEntry = {
  url: string;
  duration: number;
  size: number;
  markers: SessionMarker[];
};

// Reciter manifest — UNCHANGED
export type ReciterManifest = {
  id: string;
  version: number;
  type: "clips" | "session" | "hybrid";
  files: Record<string, AudioFileEntry>;
  sessions?: Record<string, SessionFileEntry>;
};

// Queue item for the player engine — simplified
export type QueueItem = {
  athkarId: string;
  thikrId: string;
  totalRepeats: number;
  audioFile: AudioFileEntry | null;
  localPath: string | null;
};

// State
export type AthkarAudioState = {
  // Settings (persisted)
  playbackMode: PlaybackMode;
  selectedReciterId: string | null;
  repeatLimit: RepeatLimit;
  comfortMode: boolean;
  onboardingCompleted: boolean;

  // Playback state (runtime — read-only mirror of RNTP)
  playerState: PlayerState;
  currentThikrId: string | null;
  currentAthkarId: string | null;
  repeatProgress: { current: number; total: number };
  sessionProgress: { current: number; total: number };
  position: number;
  duration: number;

  // UI state
  showBottomSheet: boolean;
  showCompletion: boolean;

  // Download state (runtime)
  downloads: Record<string, DownloadStatus>;
  downloadProgress: Record<string, number>;
  totalStorageUsed: number;
};

// Actions — simplified, no more bridge setters
export type AthkarAudioActions = {
  // State setters (called by athkarPlayer service only)
  setPlayerState: (state: PlayerState) => void;
  setCurrentTrack: (thikrId: string | null, athkarId: string | null) => void;
  setRepeatProgress: (progress: { current: number; total: number }) => void;
  setSessionProgress: (progress: { current: number; total: number }) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setShowBottomSheet: (show: boolean) => void;
  setShowCompletion: (show: boolean) => void;

  // Settings
  setPlaybackMode: (mode: PlaybackMode) => void;
  selectReciter: (id: string) => void;
  setRepeatLimit: (limit: RepeatLimit) => void;
  toggleComfortMode: () => void;
  setOnboardingCompleted: (completed: boolean) => void;

  // Downloads
  setDownloadStatus: (thikrId: string, status: DownloadStatus) => void;
  setDownloadProgress: (thikrId: string, progress: number) => void;
  setTotalStorageUsed: (bytes: number) => void;
  clearDownloads: () => void;

  // Reset
  resetPlaybackState: () => void;
};
