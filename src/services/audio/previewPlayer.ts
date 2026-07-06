import { createAudioPlayer, type AudioPlayer, type AudioStatus } from "expo-audio";

import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("athkar-audio");

// A dedicated, foreground-only player for short previews (notification sounds,
// reciter samples), separate from the nitro session player so a preview can never
// touch the loaded athkar queue. Deliberately does not set a global audio mode —
// it leaves the session the nitro player owns untouched.

let player: AudioPlayer | null = null;

const getPlayer = (): AudioPlayer => {
  if (!player) player = createAudioPlayer();
  return player;
};

export const playPreview = async (source: string | number): Promise<void> => {
  try {
    const p = getPlayer();
    p.replace(source as string);
    p.play();
  } catch (error) {
    log.w("Preview", `preview play failed: ${(error as Error)?.message}`);
    throw error;
  }
};

export const stopPreview = async (): Promise<void> => {
  try {
    player?.pause();
    await player?.seekTo(0);
  } catch {
    // best-effort — a failed stop leaves nothing running worth surfacing
  }
};

// Subscribe to the shared preview player's status (for the sample progress ring
// and end-of-sample detection). Returns an unsubscribe function.
export const addPreviewListener = (
  cb: (status: {
    playing: boolean;
    didJustFinish: boolean;
    currentTime: number;
    duration: number;
  }) => void
): (() => void) => {
  const p = getPlayer();
  const subscription = p.addListener("playbackStatusUpdate", (status: AudioStatus) => {
    cb({
      playing: status.playing,
      didJustFinish: status.didJustFinish,
      currentTime: status.currentTime ?? 0,
      duration: status.duration ?? 0,
    });
  });
  return () => subscription.remove();
};
