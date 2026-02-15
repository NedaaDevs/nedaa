import { useAudioPlayer } from "expo-audio";

import { SMART_PAUSE, getThikrId, PLAYBACK_MODE } from "@/constants/AthkarAudio";
import { audioDownloadManager } from "@/services/athkar-audio-download";
import { soundPreviewManager } from "@/utils/sound";

import type {
  PlayerState,
  PlaybackMode,
  RepeatLimit,
  ReciterManifest,
  QueueItem,
} from "@/types/athkar-audio";
import type { Athkar } from "@/types/athkar";

type PlayerInstance = ReturnType<typeof useAudioPlayer>;

type StateChangeCallback = (state: PlayerState) => void;
type CountIncrementCallback = (athkarId: string) => void;
type ThikrChangeCallback = (
  thikrId: string | null,
  currentRepeat: number,
  totalRepeats: number
) => void;
type ProgressCallback = (current: number, total: number) => void;
type AudioPositionCallback = (position: number, duration: number) => void;

type AudioStatus = {
  playing: boolean;
  currentTime: number;
  duration: number;
};

type MetadataResolver = (thikrId: string, reciterId: string) => { title: string; artist: string };

class AthkarPlayer {
  private static instance: AthkarPlayer;

  private player: PlayerInstance | null = null;
  private playerId: string | null = null;

  private queue: QueueItem[] = [];
  private queueIndex = 0;
  private currentRepeat = 0;

  private state: PlayerState = "idle";
  private mode: PlaybackMode = "off";
  private repeatLimit: RepeatLimit = "all";
  private reciterId: string | null = null;

  private advanceTimer: ReturnType<typeof setTimeout> | null = null;
  private handlingEnd = false;

  private metadataResolver: MetadataResolver | null = null;

  // Callbacks
  private onStateChange: StateChangeCallback | null = null;
  private onCountIncrement: CountIncrementCallback | null = null;
  private onThikrChange: ThikrChangeCallback | null = null;
  private onSessionProgress: ProgressCallback | null = null;
  private onAudioPosition: AudioPositionCallback | null = null;

  private constructor() {}

  static getInstance(): AthkarPlayer {
    if (!AthkarPlayer.instance) {
      AthkarPlayer.instance = new AthkarPlayer();
    }
    return AthkarPlayer.instance;
  }

  // --- Setup ---

  setPlayer(player: PlayerInstance, playerId: string) {
    this.player = player;
    this.playerId = playerId;
  }

  setCallbacks(callbacks: {
    onStateChange?: StateChangeCallback;
    onCountIncrement?: CountIncrementCallback;
    onThikrChange?: ThikrChangeCallback;
    onSessionProgress?: ProgressCallback;
    onAudioPosition?: AudioPositionCallback;
  }) {
    if (callbacks.onStateChange) this.onStateChange = callbacks.onStateChange;
    if (callbacks.onCountIncrement) this.onCountIncrement = callbacks.onCountIncrement;
    if (callbacks.onThikrChange) this.onThikrChange = callbacks.onThikrChange;
    if (callbacks.onSessionProgress) this.onSessionProgress = callbacks.onSessionProgress;
    if (callbacks.onAudioPosition) this.onAudioPosition = callbacks.onAudioPosition;
  }

  setMode(mode: PlaybackMode) {
    this.mode = mode;
  }

  setRepeatLimit(limit: RepeatLimit) {
    this.repeatLimit = limit;
  }

  setMetadataResolver(resolver: MetadataResolver) {
    this.metadataResolver = resolver;
  }

  // --- Status from useAudioPlayerStatus hook ---

  onStatusUpdate(status: AudioStatus) {
    // Forward position/duration while playing
    if (this.state === "playing") {
      this.onAudioPosition?.(status.currentTime, status.duration);
    }

    // Detect natural playback completion:
    // Our state is "playing" but the player stopped playing, and we're near the end
    if (
      this.state === "playing" &&
      !this.handlingEnd &&
      !status.playing &&
      status.duration > 0 &&
      status.currentTime >= status.duration - 0.3
    ) {
      const item = this.queue[this.queueIndex];
      if (item) {
        this.handlePlaybackEnd(item);
      }
    }
  }

  // --- Queue building ---

  buildQueue(
    athkarList: Athkar[],
    manifest: ReciterManifest,
    reciterId: string,
    sessionType: "morning" | "evening"
  ) {
    this.reciterId = reciterId;
    this.queue = athkarList.flatMap((athkar) => {
      if (athkar.group) {
        const rounds = Math.ceil(athkar.count / athkar.group.itemsPerRound);
        const entries: QueueItem[] = [];
        for (let round = 0; round < rounds; round++) {
          for (const audioId of athkar.group.audioIds) {
            const audioFile = manifest.files[audioId] ?? null;
            entries.push({
              athkarId: athkar.id,
              thikrId: audioId,
              totalRepeats: 1,
              audioFile,
              localPath: null,
            });
          }
        }
        return entries;
      }

      const thikrId = getThikrId(athkar.order, sessionType);
      const audioFile = thikrId ? (manifest.files[thikrId] ?? null) : null;

      return {
        athkarId: athkar.id,
        thikrId: thikrId ?? athkar.id,
        totalRepeats: athkar.count,
        audioFile,
        localPath: null,
      };
    });
    this.queueIndex = 0;
    this.currentRepeat = 0;
  }

  // --- Playback control ---

  async play() {
    if (!this.player || this.queue.length === 0) return;

    // Stop any sound preview first
    if (soundPreviewManager.isCurrentlyPlaying()) {
      soundPreviewManager.forceReset();
    }

    await this.loadAndPlayCurrent();
  }

  async pause() {
    if (!this.player || this.state !== "playing") return;

    try {
      this.setState("paused");
      await this.player.pause();
    } catch (error) {
      console.error("[AthkarPlayer] Pause error:", error);
    }
  }

  async resume() {
    if (!this.player || this.state !== "paused") return;

    try {
      await this.player.play();
      this.setState("playing");
    } catch (error) {
      console.error("[AthkarPlayer] Resume error:", error);
    }
  }

  async next() {
    this.clearAdvanceTimer();

    if (this.queueIndex < this.queue.length - 1) {
      this.queueIndex++;
      this.currentRepeat = 0;
      await this.loadAndPlayCurrent();
    } else {
      this.setState("completed");
      this.onSessionProgress?.(this.queue.length, this.queue.length);
    }
  }

  async previous() {
    this.clearAdvanceTimer();

    if (this.queueIndex > 0) {
      this.queueIndex--;
      this.currentRepeat = 0;
      await this.loadAndPlayCurrent();
    } else {
      // Restart current
      this.currentRepeat = 0;
      await this.loadAndPlayCurrent();
    }
  }

  dismiss() {
    this.clearAdvanceTimer();
    this.handlingEnd = false;

    if (this.player) {
      try {
        this.player.clearLockScreenControls();
        this.player.pause();
      } catch {
        // Ignore
      }
    }

    this.setState("idle");
  }

  stop() {
    this.dismiss();
    this.queue = [];
    this.queueIndex = 0;
    this.currentRepeat = 0;
    this.onThikrChange?.(null, 0, 0);
  }

  async seekTo(seconds: number) {
    if (!this.player) return;
    try {
      await this.player.seekTo(seconds);
    } catch (error) {
      console.error("[AthkarPlayer] Seek error:", error);
    }
  }

  async jumpTo(athkarId: string, currentCount: number = 0) {
    const firstIndex = this.queue.findIndex((q) => q.athkarId === athkarId);
    if (firstIndex === -1) return;

    this.clearAdvanceTimer();
    this.handlingEnd = false;

    // Check if this is a grouped item (multiple entries with same athkarId, each with totalRepeats=1)
    const matchingCount = this.queue.filter((q) => q.athkarId === athkarId).length;

    if (matchingCount > 1 && this.queue[firstIndex].totalRepeats === 1) {
      // Grouped item: offset by currentCount (clamped)
      const offset = Math.min(currentCount, matchingCount - 1);
      this.queueIndex = firstIndex + offset;
      this.currentRepeat = 0;
    } else {
      // Non-grouped item
      this.queueIndex = firstIndex;
      this.currentRepeat = 0;
    }

    await this.loadAndPlayCurrent();
  }

  // --- Internal playback ---

  private async loadAndPlayCurrent() {
    if (!this.player || !this.reciterId) return;

    const item = this.queue[this.queueIndex];
    if (!item) {
      this.setState("completed");
      return;
    }

    this.handlingEnd = false;
    this.setState("loading");
    this.onThikrChange?.(item.thikrId, this.currentRepeat, this.getEffectiveRepeats(item));
    this.onSessionProgress?.(this.queueIndex + 1, this.queue.length);

    // Resolve local path
    let localPath = item.localPath;
    if (!localPath && item.audioFile) {
      localPath = await audioDownloadManager.getLocalPath(this.reciterId, item.thikrId);

      if (!localPath && item.audioFile) {
        // Download on-demand
        localPath = await audioDownloadManager.downloadFile(
          this.reciterId,
          item.thikrId,
          item.audioFile.url,
          item.audioFile.size
        );
      }

      if (localPath) {
        item.localPath = localPath;
      }
    }

    if (!localPath) {
      // No audio available — skip to next in autopilot, stay in manual
      console.log(`[AthkarPlayer] No audio for ${item.thikrId}, skipping`);
      if (this.mode === PLAYBACK_MODE.AUTOPILOT) {
        await this.advanceToNext();
      } else {
        this.setState("idle");
      }
      return;
    }

    try {
      await this.player.replace({ uri: localPath });
      await this.player.play();
      this.setState("playing");

      // Activate lock screen controls
      this.updateLockScreen(item);

      // Prefetch next
      this.prefetchNext();
    } catch (error) {
      console.error("[AthkarPlayer] Play error:", error);
      if (this.mode === PLAYBACK_MODE.AUTOPILOT) {
        await this.advanceToNext();
      } else {
        this.setState("idle");
      }
    }
  }

  private async handlePlaybackEnd(item: QueueItem) {
    if (this.handlingEnd) return;
    this.handlingEnd = true;

    const effectiveRepeats = this.getEffectiveRepeats(item);

    // Increment count in autopilot mode
    if (this.mode === PLAYBACK_MODE.AUTOPILOT) {
      this.onCountIncrement?.(item.athkarId);
    }

    this.currentRepeat++;
    this.onThikrChange?.(item.thikrId, this.currentRepeat, effectiveRepeats);

    if (this.currentRepeat < effectiveRepeats) {
      // Replay same file
      try {
        if (this.player) {
          this.setState("loading");
          await this.player.seekTo(0);
          await this.player.play();
          this.handlingEnd = false;
          this.setState("playing");
        }
      } catch (error) {
        console.error("[AthkarPlayer] Replay error:", error);
        this.handlingEnd = false;
        await this.advanceToNext();
      }
    } else {
      // Move to next thikr
      this.handlingEnd = false;
      await this.advanceToNext();
    }
  }

  private async advanceToNext() {
    if (this.queueIndex >= this.queue.length - 1) {
      this.setState("completed");
      this.onSessionProgress?.(this.queue.length, this.queue.length);
      return;
    }

    // Smart pause
    const currentItem = this.queue[this.queueIndex];
    const pauseDuration = this.getSmartPause(currentItem?.audioFile?.duration ?? 0);

    if (pauseDuration > 0) {
      this.setState("advancing");
      this.advanceTimer = setTimeout(async () => {
        if (this.state !== "advancing") return;

        this.queueIndex++;
        this.currentRepeat = 0;

        if (this.mode === PLAYBACK_MODE.AUTOPILOT) {
          await this.loadAndPlayCurrent();
        } else {
          this.onThikrChange?.(
            this.queue[this.queueIndex]?.thikrId ?? null,
            0,
            this.getEffectiveRepeats(this.queue[this.queueIndex])
          );
          this.onSessionProgress?.(this.queueIndex + 1, this.queue.length);
          this.setState("idle");
        }
      }, pauseDuration);
    } else {
      this.queueIndex++;
      this.currentRepeat = 0;

      if (this.mode === PLAYBACK_MODE.AUTOPILOT) {
        await this.loadAndPlayCurrent();
      } else {
        this.onThikrChange?.(
          this.queue[this.queueIndex]?.thikrId ?? null,
          0,
          this.getEffectiveRepeats(this.queue[this.queueIndex])
        );
        this.onSessionProgress?.(this.queueIndex + 1, this.queue.length);
        this.setState("idle");
      }
    }
  }

  // --- Helpers ---

  private getEffectiveRepeats(item: QueueItem | undefined): number {
    if (!item) return 0;
    if (this.repeatLimit === "all") return item.totalRepeats;
    return Math.min(this.repeatLimit as number, item.totalRepeats);
  }

  private getSmartPause(audioDuration: number): number {
    if (audioDuration < SMART_PAUSE.SHORT_THRESHOLD) return SMART_PAUSE.SHORT_PAUSE;
    if (audioDuration < SMART_PAUSE.LONG_THRESHOLD) return SMART_PAUSE.MEDIUM_PAUSE;
    return SMART_PAUSE.LONG_PAUSE;
  }

  private updateLockScreen(item: QueueItem) {
    if (!this.player || !this.reciterId) return;

    const metadata = this.metadataResolver
      ? this.metadataResolver(item.thikrId, this.reciterId)
      : { title: item.thikrId, artist: this.reciterId };

    try {
      this.player.setActiveForLockScreen(true, metadata, {
        showSeekForward: false,
        showSeekBackward: false,
      });
    } catch (error) {
      console.error("[AthkarPlayer] Lock screen error:", error);
    }
  }

  private setState(newState: PlayerState) {
    this.state = newState;
    this.onStateChange?.(newState);
  }

  private clearAdvanceTimer() {
    if (this.advanceTimer) {
      clearTimeout(this.advanceTimer);
      this.advanceTimer = null;
    }
  }

  private async prefetchNext() {
    if (!this.reciterId) return;
    const nextItem = this.queue[this.queueIndex + 1];
    if (!nextItem?.audioFile || nextItem.localPath) return;

    const path = await audioDownloadManager.getLocalPath(this.reciterId, nextItem.thikrId);
    if (path) {
      nextItem.localPath = path;
    }
  }

  // --- Getters ---

  getState(): PlayerState {
    return this.state;
  }

  getCurrentQueueIndex(): number {
    return this.queueIndex;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  isActive(): boolean {
    return this.state !== "idle" && this.state !== "completed";
  }

  notifyPlayerUnmount(id: string) {
    if (this.playerId === id) {
      this.stop();
      this.player = null;
      this.playerId = null;
    }
  }
}

export const athkarPlayer = AthkarPlayer.getInstance();
