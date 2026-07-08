import { Platform, PermissionsAndroid } from "react-native";
import { TrackPlayer } from "react-native-nitro-player";
import type { TrackItem, TrackPlayerState, Reason } from "react-native-nitro-player";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("audio-session");

// Nitro's playback states and state-change reasons, named so comparisons aren't
// bare string literals. Values mirror the library's TrackPlayerState / Reason.
export const NITRO_STATE = {
  PLAYING: "playing",
  PAUSED: "paused",
  STOPPED: "stopped",
  BUFFERING: "buffering",
} as const;

export const NITRO_REASON = {
  USER_ACTION: "user_action",
  SKIP: "skip",
  END: "end",
  ERROR: "error",
  REPEAT: "repeat",
} as const;

export type NitroOwner = "athkar" | "quran" | "debug";

export type NitroHandlers = {
  // `reason` distinguishes an auto-advance ("end") from a user skip.
  onChangeTrack?: (track: TrackItem, reason?: Reason) => void;
  // `reason` distinguishes a natural queue-end ("end") from an error/interruption.
  onPlaybackStateChange?: (state: TrackPlayerState, reason?: Reason) => void;
  onProgress?: (position: number, duration: number, seeked: boolean) => void;
  // Called when another owner takes the player; the losing owner must tear down.
  // Return a promise so acquire() can wait for teardown before the new owner loads.
  onEvict?: () => void | Promise<void>;
};

// One process-wide arbiter for nitro's single global player. Only this module
// attaches nitro listeners; it dispatches each event to the current owner, so
// two players never both react. Ownership hands off explicitly on acquire().
const handlers: Partial<Record<NitroOwner, NitroHandlers>> = {};
let currentOwner: NitroOwner | null = null;
let started = false;

const register = (owner: NitroOwner, h: NitroHandlers): void => {
  handlers[owner] = h;
};

const ensureStarted = async (): Promise<void> => {
  if (started) return;
  TrackPlayer.onChangeTrack((track: TrackItem, reason?: Reason) => {
    if (currentOwner) handlers[currentOwner]?.onChangeTrack?.(track, reason);
  });
  TrackPlayer.onPlaybackStateChange((state: TrackPlayerState, reason?: Reason) => {
    if (currentOwner) handlers[currentOwner]?.onPlaybackStateChange?.(state, reason);
  });
  TrackPlayer.onPlaybackProgressChange(
    (position: number, totalDuration: number, isManuallySeeked?: boolean) => {
      if (currentOwner)
        handlers[currentOwner]?.onProgress?.(position, totalDuration, isManuallySeeked ?? false);
    }
  );
  await TrackPlayer.configure({
    showInNotification: true,
    androidAutoEnabled: false,
    carPlayEnabled: false,
  });
  if (Platform.OS === "android" && Platform.Version >= 33) {
    await PermissionsAndroid.request("android.permission.POST_NOTIFICATIONS" as never).catch(
      () => {}
    );
  }
  started = true;
  log.d("Session", "nitro session started");
};

// Awaits the outgoing owner's teardown before handing the player over, so the
// new owner never loads its queue while the old one is still deleting its own.
const acquire = async (owner: NitroOwner): Promise<void> => {
  if (currentOwner === owner) return;
  if (currentOwner) {
    log.i("Session", `evicting ${currentOwner} for ${owner}`);
    // Pause before teardown so the outgoing owner's audio can't keep sounding
    // during the incoming owner's (possibly slow) build, or orphan if it fails.
    await TrackPlayer.pause().catch(() => {});
    await handlers[currentOwner]?.onEvict?.();
  }
  currentOwner = owner;
};

const release = (owner: NitroOwner): void => {
  if (currentOwner === owner) currentOwner = null;
};

const owns = (owner: NitroOwner): boolean => currentOwner === owner;
const current = (): NitroOwner | null => currentOwner;

const __resetForTest = (): void => {
  currentOwner = null;
  started = false;
  delete handlers.athkar;
  delete handlers.quran;
};

export const nitroSession = {
  register,
  ensureStarted,
  acquire,
  release,
  owns,
  current,
  __resetForTest,
};
