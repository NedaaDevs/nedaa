import { Asset } from "expo-asset";
import { PlayerQueue, TrackPlayer } from "react-native-nitro-player";
import type { Reason, TrackItem, TrackPlayerState } from "react-native-nitro-player";

import { NITRO_REASON, NITRO_STATE, nitroSession } from "@/services/audio/nitroSession";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("athkar-audio");

const PREVIEW_OWNER = "preview" as const;
const PREVIEW_TRACK_ID = "preview-track";

type PreviewStatus = {
  playing: boolean;
  didJustFinish: boolean;
  currentTime: number;
  duration: number;
};

const listeners = new Set<(status: PreviewStatus) => void>();

let playlistId: string | null = null;
let playing = false;
let currentTime = 0;
let duration = 0;
let reachedPlaying = false;
let finishing = false;
let initialized = false;
let initializationPromise: Promise<void> | null = null;
let commandTail: Promise<void> = Promise.resolve();
let latestRequest = 0;

const emitStatus = (didJustFinish = false): void => {
  const status: PreviewStatus = { playing, didJustFinish, currentTime, duration };
  listeners.forEach((listener) => {
    try {
      listener(status);
    } catch (error) {
      log.w("Preview", `preview listener failed: ${(error as Error)?.message}`);
    }
  });
};

// Serialize mutations of Nitro's global queue. Asset resolution happens before
// entering this chain so a slow extraction does not block stop/evict commands.
const runCommand = (command: () => Promise<void>): Promise<void> => {
  const result = commandTail.then(command, command);
  commandTail = result.catch(() => {});
  return result;
};

const deletePlaylist = async (id: string | null): Promise<void> => {
  if (!id) return;
  await PlayerQueue.deletePlaylist(id).catch(() => {});
};

const teardown = async (notifyStopped: boolean): Promise<void> => {
  const id = playlistId;
  const hadPreview = id !== null || playing || currentTime > 0 || duration > 0;
  playlistId = null;
  playing = false;
  currentTime = 0;
  duration = 0;
  reachedPlaying = false;
  finishing = false;
  if (notifyStopped && hadPreview) emitStatus();
  await deletePlaylist(id);
  nitroSession.release(PREVIEW_OWNER);
};

const onPlaybackStateChange = (state: TrackPlayerState, reason?: Reason): void => {
  if (!playlistId || finishing) return;

  if (state === NITRO_STATE.PLAYING) {
    reachedPlaying = true;
    playing = true;
    emitStatus();
    return;
  }

  if (state === NITRO_STATE.BUFFERING) {
    playing = false;
    emitStatus();
    return;
  }

  if (state === NITRO_STATE.PAUSED) {
    // A pause before PLAYING belongs to the queue that Nitro just replaced.
    if (!reachedPlaying) return;
    playing = false;
    emitStatus();
    return;
  }

  if (state !== NITRO_STATE.STOPPED) return;

  if (reason === NITRO_REASON.END) {
    // Android can deliver the previous queue's end after preview ownership swaps.
    // A natural end cannot precede PLAYING for the current preview.
    if (!reachedPlaying) {
      log.w("Preview", "ignoring stale end before playback started");
      return;
    }
    finishing = true;
    reachedPlaying = false;
    playing = false;
    emitStatus(true);
    void runCommand(() => teardown(false));
    return;
  }

  playing = false;
  emitStatus();
};

const onProgress = (position: number, totalDuration: number): void => {
  // Drop delayed progress from the queue replaced during ownership handoff.
  if (!playlistId || !reachedPlaying || finishing) return;
  currentTime = position;
  duration = totalDuration;
  emitStatus();
};

const ensureInitialized = async (): Promise<void> => {
  if (initialized) return;
  if (!initializationPromise) {
    nitroSession.register(PREVIEW_OWNER, {
      onPlaybackStateChange,
      onProgress,
      onEvict: () => runCommand(() => teardown(true)),
    });
    initializationPromise = nitroSession
      .ensureStarted()
      .then(() => {
        initialized = true;
      })
      .catch((error) => {
        initializationPromise = null;
        throw error;
      });
  }
  await initializationPromise;
};

const resolveSourceUri = async (source: string | number): Promise<string> => {
  if (typeof source === "string") return source;
  const asset = await Asset.fromModule(source).downloadAsync();
  return asset.localUri ?? asset.uri;
};

const loadPreview = async (url: string, request: number): Promise<void> => {
  await ensureInitialized();
  if (request !== latestRequest) return;

  await nitroSession.acquire(PREVIEW_OWNER);
  if (request !== latestRequest) return;

  // Invalidate late events before pausing and replacing the current playlist.
  reachedPlaying = false;
  finishing = false;
  playing = false;
  currentTime = 0;
  duration = 0;
  if (playlistId) {
    await TrackPlayer.pause().catch(() => {});
    const previousPlaylistId = playlistId;
    playlistId = null;
    await deletePlaylist(previousPlaylistId);
  }

  const id = await PlayerQueue.createPlaylist("preview");
  playlistId = id;
  const track: TrackItem = {
    id: PREVIEW_TRACK_ID,
    title: "Preview",
    artist: "",
    album: "",
    duration: 0,
    url,
  };
  await PlayerQueue.addTracksToPlaylist(id, [track]);
  await PlayerQueue.loadPlaylist(id);
  await TrackPlayer.setRepeatMode("off");
  // Nitro can drop a lone play command immediately after loading a playlist.
  await TrackPlayer.playSong(PREVIEW_TRACK_ID, id);
  await TrackPlayer.play();
};

export const playPreview = async (source: string | number): Promise<void> => {
  const request = ++latestRequest;
  try {
    const url = await resolveSourceUri(source);
    if (request !== latestRequest) return;
    await runCommand(() => loadPreview(url, request));
  } catch (error) {
    if (request === latestRequest) {
      reachedPlaying = false;
      await runCommand(async () => {
        if (nitroSession.owns(PREVIEW_OWNER)) await TrackPlayer.pause().catch(() => {});
        await teardown(true);
      });
    }
    log.w("Preview", `preview play failed: ${(error as Error)?.message}`);
    throw error;
  }
};

export const stopPreview = async (): Promise<void> => {
  latestRequest += 1;
  // Reject a late natural-end callback as soon as a user stop is requested.
  reachedPlaying = false;
  try {
    await runCommand(async () => {
      if (nitroSession.owns(PREVIEW_OWNER)) await TrackPlayer.pause().catch(() => {});
      await teardown(true);
    });
  } catch {
    // Stopping a short preview is best-effort.
  }
};

export const addPreviewListener = (
  cb: (status: {
    playing: boolean;
    didJustFinish: boolean;
    currentTime: number;
    duration: number;
  }) => void
): (() => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
