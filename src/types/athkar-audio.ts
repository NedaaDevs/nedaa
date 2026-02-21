import { PLAYBACK_MODE, REPEAT_LIMIT_OPTIONS } from "@/constants/AthkarAudio";

// Playback mode
export type PlaybackMode = (typeof PLAYBACK_MODE)[keyof typeof PLAYBACK_MODE];

// Repeat limit
export type RepeatLimit = (typeof REPEAT_LIMIT_OPTIONS)[number]["value"];

// State machine
export type MachineState = "idle" | "loading" | "playing" | "crossfading" | "paused" | "error";

export const VALID_TRANSITIONS: Record<MachineState, MachineState[]> = {
  idle: ["loading"],
  loading: ["playing", "error", "idle"],
  playing: ["crossfading", "paused", "idle", "error", "loading"],
  crossfading: ["playing", "error", "idle"],
  paused: ["loading", "idle", "playing"],
  error: ["loading", "idle"],
};

export type PlayerState = MachineState;

// Download status
export type DownloadStatus = "pending" | "downloading" | "complete" | "failed";

// Reciter catalog entry (from API)
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

// Reciter catalog (from API)
export type ReciterCatalog = {
  version: number;
  reciters: ReciterCatalogEntry[];
};

// Audio file entry in manifest
export type AudioFileEntry = {
  url: string;
  duration: number;
  size: number;
};

// Session marker for full session recordings
export type SessionMarker = {
  thikrId: string;
  start: number;
  end: number;
  totalCount: number;
};

// Session file entry
export type SessionFileEntry = {
  url: string;
  duration: number;
  size: number;
  markers: SessionMarker[];
};

// Reciter manifest (per-reciter, fetched from manifestUrl)
export type ReciterManifest = {
  id: string;
  version: number;
  type: "clips" | "session" | "hybrid";
  files: Record<string, AudioFileEntry>;
  sessions?: Record<string, SessionFileEntry>;
};

// Queue item for the player engine
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
  audioControlsExpanded: boolean;

  // Playback state (runtime)
  playerState: PlayerState;
  currentThikrId: string | null;
  currentRepeat: number;
  totalRepeats: number;
  sessionProgress: { current: number; total: number };
  audioDuration: number;
  audioPosition: number;

  // Download state (runtime)
  downloads: Record<string, DownloadStatus>;
  downloadProgress: Record<string, number>;
  totalStorageUsed: number;
};

// Actions
export type AthkarAudioActions = {
  // Playback
  play: () => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  stop: () => void;
  dismiss: () => void;
  seekTo: (seconds: number) => void;

  // State setters (called by bridge/engine)
  setPlayerState: (state: PlayerState) => void;
  setCurrentThikrId: (id: string | null) => void;
  setCurrentRepeat: (repeat: number) => void;
  setTotalRepeats: (total: number) => void;
  setSessionProgress: (progress: { current: number; total: number }) => void;
  setAudioDuration: (duration: number) => void;
  setAudioPosition: (position: number) => void;

  // Settings
  setPlaybackMode: (mode: PlaybackMode) => void;
  selectReciter: (id: string) => void;
  setRepeatLimit: (limit: RepeatLimit) => void;
  toggleComfortMode: () => void;
  setOnboardingCompleted: (completed: boolean) => void;
  setAudioControlsExpanded: (expanded: boolean) => void;

  // Downloads
  setDownloadStatus: (thikrId: string, status: DownloadStatus) => void;
  setDownloadProgress: (thikrId: string, progress: number) => void;
  setTotalStorageUsed: (bytes: number) => void;
  clearDownloads: () => void;

  // Reset
  resetPlaybackState: () => void;
};
