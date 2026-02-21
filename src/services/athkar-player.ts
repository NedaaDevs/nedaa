import { AppState } from "react-native";
import type { AppStateStatus } from "react-native";
import { setAudioModeAsync } from "expo-audio";
import type { AudioPlayer } from "expo-audio";
import type { RefObject } from "react";

import { SMART_PAUSE, getThikrId, PLAYBACK_MODE } from "@/constants/AthkarAudio";
import { audioDownloadManager } from "@/services/athkar-audio-download";
import { soundPreviewManager } from "@/utils/sound";
import { AppLogger } from "@/utils/appLogger";
import { VALID_TRANSITIONS } from "@/types/athkar-audio";
import type {
  MachineState,
  PlaybackMode,
  RepeatLimit,
  ReciterManifest,
  QueueItem,
} from "@/types/athkar-audio";
import type { Athkar } from "@/types/athkar";

const log = AppLogger.create("athkar-audio");

const CROSSFADE_MS = 400;
const CROSSFADE_STEP_MS = 25;
const PREFETCH_AHEAD = 3;
const MAX_CONSECUTIVE_ERRORS = 3;

type StateChangeCallback = (state: MachineState) => void;
type CountIncrementCallback = (athkarId: string) => void;
type ThikrChangeCallback = (
  thikrId: string | null,
  currentRepeat: number,
  totalRepeats: number
) => void;
type ProgressCallback = (current: number, total: number) => void;
type AudioPositionCallback = (position: number, duration: number) => void;
type ErrorCallback = (message: string) => void;
type SessionCompleteCallback = () => void;

type AudioStatus = {
  playing: boolean;
  currentTime: number;
  duration: number;
};

type MetadataResolver = (
  thikrId: string,
  reciterId: string
) => { title: string; artist: string; artworkUrl?: string };

class AthkarPlayer {
  private static instance: AthkarPlayer;

  // Player refs (from bridge)
  private refA: RefObject<AudioPlayer> | null = null;
  private refB: RefObject<AudioPlayer> | null = null;
  private activeSlot: "a" | "b" = "a";
  private mounted = false;

  // Buffer tracking
  private bufferThikrId: string | null = null;
  private bufferLocalPath: string | null = null;

  // Queue
  private queue: QueueItem[] = [];
  private queueIndex = 0;
  private currentRepeat = 0;

  // State machine
  private state: MachineState = "idle";
  private mode: PlaybackMode = "off";
  private repeatLimit: RepeatLimit = "all";
  private reciterId: string | null = null;

  // Timers & flags
  private advanceTimer: ReturnType<typeof setTimeout> | null = null;
  private crossfadeTimer: ReturnType<typeof setInterval> | null = null;
  private handlingEnd = false;
  private consecutiveErrors = 0;
  private currentDuration = 0;

  // Download dedup
  private activeDownloads: Map<string, Promise<string | null>> = new Map();
  private failedDownloads: Set<string> = new Set();

  // Metadata
  private metadataResolver: MetadataResolver | null = null;

  // Callbacks
  private onStateChange: StateChangeCallback | null = null;
  private onCountIncrement: CountIncrementCallback | null = null;
  private onThikrChange: ThikrChangeCallback | null = null;
  private onSessionProgress: ProgressCallback | null = null;
  private onAudioPosition: AudioPositionCallback | null = null;
  private onError: ErrorCallback | null = null;
  private onSessionComplete: SessionCompleteCallback | null = null;

  // AppState listener
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

  private constructor() {
    this.appStateSubscription = AppState.addEventListener("change", this.handleAppStateChange);
  }

  static getInstance(): AthkarPlayer {
    if (!AthkarPlayer.instance) {
      AthkarPlayer.instance = new AthkarPlayer();
    }
    return AthkarPlayer.instance;
  }

  // ─── State Machine ─────────────────────────────────────────────────

  private transition(to: MachineState): boolean {
    const allowed = VALID_TRANSITIONS[this.state];
    if (!allowed.includes(to)) {
      log.w("Player", `Invalid transition: ${this.state} → ${to}`);
      return false;
    }
    const from = this.state;
    this.state = to;
    log.d("Player", `State: ${from} → ${to}`);
    this.onStateChange?.(to);
    return true;
  }

  // ─── Player Ref Accessors ──────────────────────────────────────────

  private get activePlayer(): AudioPlayer | null {
    const ref = this.activeSlot === "a" ? this.refA : this.refB;
    return ref?.current ?? null;
  }

  private get bufferPlayer(): AudioPlayer | null {
    const ref = this.activeSlot === "a" ? this.refB : this.refA;
    return ref?.current ?? null;
  }

  private swapPlayers() {
    const outgoing = this.activePlayer;
    if (outgoing) {
      try {
        outgoing.pause();
      } catch {
        // safe — player may already be paused
      }
    }
    this.activeSlot = this.activeSlot === "a" ? "b" : "a";
  }

  getActiveSlot(): "a" | "b" {
    return this.activeSlot;
  }

  // ─── Setup ─────────────────────────────────────────────────────────

  setPlayers(refA: RefObject<AudioPlayer>, refB: RefObject<AudioPlayer>) {
    this.refA = refA;
    this.refB = refB;
    this.mounted = true;
    this.bufferThikrId = null;
    this.bufferLocalPath = null;
    log.i("Player", "Player refs set");
  }

  setCallbacks(callbacks: {
    onStateChange?: StateChangeCallback;
    onCountIncrement?: CountIncrementCallback;
    onThikrChange?: ThikrChangeCallback;
    onSessionProgress?: ProgressCallback;
    onAudioPosition?: AudioPositionCallback;
    onError?: ErrorCallback;
    onSessionComplete?: SessionCompleteCallback;
  }) {
    if (callbacks.onStateChange) this.onStateChange = callbacks.onStateChange;
    if (callbacks.onCountIncrement) this.onCountIncrement = callbacks.onCountIncrement;
    if (callbacks.onThikrChange) this.onThikrChange = callbacks.onThikrChange;
    if (callbacks.onSessionProgress) this.onSessionProgress = callbacks.onSessionProgress;
    if (callbacks.onAudioPosition) this.onAudioPosition = callbacks.onAudioPosition;
    if (callbacks.onError) this.onError = callbacks.onError;
    if (callbacks.onSessionComplete) this.onSessionComplete = callbacks.onSessionComplete;
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

  // ─── Audio Session Recovery ────────────────────────────────────────

  private async ensureAudioSession() {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: "doNotMix",
      });
    } catch (error) {
      log.e("Player", "Audio session setup failed", error instanceof Error ? error : undefined);
    }
  }

  private handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === "active" && this.state === "playing") {
      this.ensureAudioSession();
    }
  };

  // ─── Status from useAudioPlayerStatus hook ─────────────────────────

  onStatusUpdate(status: AudioStatus) {
    if (!this.mounted) return;

    if (status.duration > 0) {
      this.currentDuration = status.duration;
    }

    if (this.state === "playing") {
      this.onAudioPosition?.(status.currentTime, status.duration);

      // Check if approaching end for crossfade trigger
      if (
        status.duration > 0 &&
        status.currentTime >= status.duration - 0.8 &&
        !this.handlingEnd &&
        this.bufferThikrId &&
        this.bufferLocalPath
      ) {
        const item = this.queue[this.queueIndex];
        if (item) {
          this.handlePlaybackEnd(item);
        }
        return;
      }
    }

    // Detect natural playback completion (no crossfade scenario)
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

  // ─── Queue Building ────────────────────────────────────────────────

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
    log.i("Player", `Queue built with ${this.queue.length} items for ${sessionType}`);
  }

  // ─── Playback Control ──────────────────────────────────────────────

  async play() {
    if (!this.activePlayer || this.queue.length === 0) return;

    if (soundPreviewManager.isCurrentlyPlaying()) {
      soundPreviewManager.forceReset();
    }

    await this.loadAndPlayCurrent();
  }

  async pause() {
    if (!this.activePlayer || this.state !== "playing") return;

    try {
      this.activePlayer.pause();
      this.transition("paused");
      log.i("Player", "Paused");
    } catch (error) {
      log.e("Player", "Pause error", error instanceof Error ? error : undefined);
    }
  }

  async resume() {
    if (!this.activePlayer || this.state !== "paused") return;

    try {
      await this.ensureAudioSession();
      this.activePlayer.play();
      this.transition("playing");
    } catch (error) {
      log.e("Player", "Resume error", error instanceof Error ? error : undefined);
    }
  }

  async next() {
    this.clearAdvanceTimer();
    this.clearCrossfadeTimer();
    this.invalidateBuffer();

    if (this.queueIndex < this.queue.length - 1) {
      this.queueIndex++;
      this.currentRepeat = 0;
      await this.loadAndPlayCurrent();
    } else {
      log.i("Player", "Session completed");
      this.transition("idle");
      this.onSessionProgress?.(this.queue.length, this.queue.length);
      this.onSessionComplete?.();
    }
  }

  async previous() {
    this.clearAdvanceTimer();
    this.clearCrossfadeTimer();
    this.invalidateBuffer();

    if (this.queueIndex > 0) {
      this.queueIndex--;
      this.currentRepeat = 0;
      await this.loadAndPlayCurrent();
    } else {
      this.currentRepeat = 0;
      await this.loadAndPlayCurrent();
    }
  }

  dismiss() {
    this.clearAdvanceTimer();
    this.clearCrossfadeTimer();
    this.handlingEnd = false;

    for (const ref of [this.refA, this.refB]) {
      const p = ref?.current;
      if (p) {
        try {
          p.clearLockScreenControls();
          p.pause();
        } catch {
          // safe
        }
      }
    }

    this.invalidateBuffer();
    this.transition("idle");
  }

  stop() {
    this.dismiss();
    log.i("Player", "Stopped");
    this.queue = [];
    this.queueIndex = 0;
    this.currentRepeat = 0;
    this.activeDownloads.clear();
    this.failedDownloads.clear();
    this.onThikrChange?.(null, 0, 0);
  }

  async seekTo(seconds: number) {
    if (!this.activePlayer) return;
    try {
      await this.activePlayer.seekTo(seconds);
      this.onAudioPosition?.(seconds, this.currentDuration);
    } catch (error) {
      log.e("Player", "Seek error", error instanceof Error ? error : undefined);
    }
  }

  async jumpTo(athkarId: string, currentCount: number = 0) {
    const firstIndex = this.queue.findIndex((q) => q.athkarId === athkarId);
    if (firstIndex === -1) return;

    this.clearAdvanceTimer();
    this.clearCrossfadeTimer();
    this.handlingEnd = false;
    this.invalidateBuffer();

    const matchingCount = this.queue.filter((q) => q.athkarId === athkarId).length;

    if (matchingCount > 1 && this.queue[firstIndex].totalRepeats === 1) {
      const offset = Math.min(currentCount, matchingCount - 1);
      this.queueIndex = firstIndex + offset;
      this.currentRepeat = 0;
    } else {
      this.queueIndex = firstIndex;
      this.currentRepeat = 0;
    }

    await this.loadAndPlayCurrent();
  }

  // ─── Internal Playback ─────────────────────────────────────────────

  private async loadAndPlayCurrent() {
    const player = this.activePlayer;
    if (!player || !this.reciterId) return;

    const item = this.queue[this.queueIndex];
    if (!item) {
      this.transition("idle");
      this.onSessionComplete?.();
      return;
    }

    this.handlingEnd = false;
    this.onThikrChange?.(item.thikrId, this.currentRepeat, this.getEffectiveRepeats(item));
    this.onSessionProgress?.(this.queueIndex + 1, this.queue.length);

    // Check if buffer has this track preloaded
    if (this.bufferThikrId === item.thikrId && this.bufferLocalPath) {
      log.d("Player", `Swapping to preloaded ${item.thikrId}`);
      this.swapPlayers();
      item.localPath = this.bufferLocalPath;
      this.bufferThikrId = null;
      this.bufferLocalPath = null;

      try {
        await this.ensureAudioSession();
        const success = this.playWithRetry();
        if (success) {
          this.consecutiveErrors = 0;
          this.transition("playing");
          log.d(
            "Player",
            `Playing ${item.thikrId} (repeat ${this.currentRepeat + 1}/${this.getEffectiveRepeats(item)})`
          );
          this.updateLockScreen(item);
          this.prefetchAhead();
          return;
        }
      } catch {
        // Fall through to normal load
      }
      this.swapPlayers();
    }

    // Normal load path
    this.transition("loading");

    let localPath = item.localPath;
    if (!localPath && item.audioFile) {
      localPath = await this.resolveLocalPath(
        this.reciterId,
        item.thikrId,
        item.audioFile.url,
        item.audioFile.size
      );
      if (localPath) {
        item.localPath = localPath;
      }
    }

    if (!localPath) {
      log.w("Player", `No audio for ${item.thikrId}, skipping`);
      this.onError?.("trackUnavailable");
      if (this.mode === PLAYBACK_MODE.AUTOPILOT) {
        await this.advanceToNext();
      } else {
        this.transition("idle");
      }
      return;
    }

    try {
      await this.ensureAudioSession();
      try {
        player.pause();
      } catch {
        /* safe */
      }
      player.replace({ uri: localPath });
      const success = this.playWithRetry();

      if (!success) {
        this.consecutiveErrors++;
        log.e("Player", `Consecutive errors: ${this.consecutiveErrors}`);

        if (this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          log.e("Player", "Circuit breaker: too many consecutive errors");
          this.onError?.("audioSessionError");
          this.transition("error");
          return;
        }

        if (this.mode === PLAYBACK_MODE.AUTOPILOT) {
          await this.advanceToNext();
        } else {
          this.transition("error");
        }
        return;
      }

      this.consecutiveErrors = 0;
      this.transition("playing");
      log.d(
        "Player",
        `Playing ${item.thikrId} (repeat ${this.currentRepeat + 1}/${this.getEffectiveRepeats(item)})`
      );

      this.updateLockScreen(item);
      this.prefetchAhead();
    } catch (error) {
      log.e("Player", "Play error", error instanceof Error ? error : undefined);
      this.consecutiveErrors++;

      if (this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        this.onError?.("audioSessionError");
        this.transition("error");
        return;
      }

      if (this.mode === PLAYBACK_MODE.AUTOPILOT) {
        await this.advanceToNext();
      } else {
        this.transition("error");
      }
    }
  }

  private async handlePlaybackEnd(item: QueueItem) {
    if (this.handlingEnd) return;
    this.handlingEnd = true;

    const effectiveRepeats = this.getEffectiveRepeats(item);

    if (this.mode === PLAYBACK_MODE.AUTOPILOT) {
      this.onCountIncrement?.(item.athkarId);
    }

    this.currentRepeat++;
    this.onThikrChange?.(item.thikrId, this.currentRepeat, effectiveRepeats);

    if (this.currentRepeat < effectiveRepeats) {
      // Replay same file
      try {
        const player = this.activePlayer;
        if (player) {
          this.transition("loading");
          await player.seekTo(0);
          player.play();
          this.handlingEnd = false;
          this.transition("playing");
        }
      } catch (error) {
        log.e("Player", "Replay error", error instanceof Error ? error : undefined);
        this.handlingEnd = false;
        await this.advanceToNext();
      }
    } else {
      // All repeats done — check for crossfade to next track
      this.handlingEnd = false;
      const nextItem = this.queue[this.queueIndex + 1];

      if (nextItem && this.bufferThikrId === nextItem.thikrId && this.bufferLocalPath) {
        await this.crossfadeToNext();
      } else {
        await this.advanceToNext();
      }
    }
  }

  // ─── Crossfade ─────────────────────────────────────────────────────

  private async crossfadeToNext() {
    const outgoing = this.activePlayer;
    const incoming = this.bufferPlayer;
    if (!outgoing || !incoming) {
      await this.advanceToNext();
      return;
    }

    if (!this.transition("crossfading")) {
      await this.advanceToNext();
      return;
    }

    const nextItem = this.queue[this.queueIndex + 1];
    if (!nextItem) {
      await this.advanceToNext();
      return;
    }

    log.d("Player", `Crossfading to ${nextItem.thikrId}`);

    // Start incoming at volume 0
    incoming.volume = 0;
    try {
      await this.ensureAudioSession();
      incoming.play();
    } catch (error) {
      log.e("Player", "Crossfade incoming play failed", error instanceof Error ? error : undefined);
      try {
        outgoing.pause();
      } catch {
        /* safe */
      }
      this.transition("playing");
      await this.advanceToNext();
      return;
    }

    const steps = Math.ceil(CROSSFADE_MS / CROSSFADE_STEP_MS);
    let step = 0;

    await new Promise<void>((resolve) => {
      this.crossfadeTimer = setInterval(() => {
        step++;
        const progress = Math.min(step / steps, 1);

        try {
          outgoing.volume = 1 - progress;
          incoming.volume = progress;
        } catch {
          // safe — player may have been destroyed
        }

        if (progress >= 1) {
          this.clearCrossfadeTimer();
          resolve();
        }
      }, CROSSFADE_STEP_MS);
    });

    // Swap players (pauses outgoing)
    this.swapPlayers();

    // Update queue state
    this.queueIndex++;
    this.currentRepeat = 0;
    nextItem.localPath = this.bufferLocalPath;
    this.bufferThikrId = null;
    this.bufferLocalPath = null;

    // Restore active volume to full
    const newActive = this.activePlayer;
    if (newActive) {
      newActive.volume = 1;
    }

    this.consecutiveErrors = 0;
    this.transition("playing");

    this.onThikrChange?.(nextItem.thikrId, 0, this.getEffectiveRepeats(nextItem));
    this.onSessionProgress?.(this.queueIndex + 1, this.queue.length);
    this.updateLockScreen(nextItem);
    this.prefetchAhead();
  }

  private clearCrossfadeTimer() {
    if (this.crossfadeTimer) {
      clearInterval(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }
  }

  // ─── Advance ───────────────────────────────────────────────────────

  private async advanceToNext() {
    if (this.queueIndex >= this.queue.length - 1) {
      this.transition("idle");
      this.onSessionProgress?.(this.queue.length, this.queue.length);
      this.onSessionComplete?.();
      return;
    }

    const currentItem = this.queue[this.queueIndex];
    const pauseDuration = this.getSmartPause(currentItem?.audioFile?.duration ?? 0);

    if (pauseDuration > 0) {
      // Use "loading" state for smart pause (replaces old "advancing")
      this.transition("loading");
      this.advanceTimer = setTimeout(async () => {
        if (this.state !== "loading") return;

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
          this.transition("idle");
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
        this.transition("idle");
      }
    }
  }

  // ─── Play With Retry ───────────────────────────────────────────────

  private playWithRetry(maxRetries = 3): boolean {
    const player = this.activePlayer;
    if (!player) return false;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        player.play();
        return true;
      } catch (error) {
        log.e(
          "Player",
          `Play attempt ${attempt + 1} failed`,
          error instanceof Error ? error : undefined
        );
      }
    }
    return false;
  }

  // ─── Download Dedup & Resolve ──────────────────────────────────────

  private async resolveLocalPath(
    reciterId: string,
    thikrId: string,
    url: string,
    size: number
  ): Promise<string | null> {
    // Check cache first
    const existing = await audioDownloadManager.getLocalPath(reciterId, thikrId);
    if (existing) return existing;

    // Check failed cache
    const key = `${reciterId}/${thikrId}`;
    if (this.failedDownloads.has(key)) {
      log.d("Player", `Skipping previously failed download: ${key}`);
      return null;
    }

    // Dedup: return existing promise if in-flight
    if (this.activeDownloads.has(key)) {
      log.d("Player", `Joining existing download: ${key}`);
      return this.activeDownloads.get(key)!;
    }

    // Start new download
    const downloadPromise = audioDownloadManager
      .downloadFile(reciterId, thikrId, url, size)
      .then((result) => {
        this.activeDownloads.delete(key);
        if (!result) {
          this.failedDownloads.add(key);
        }
        return result;
      })
      .catch((error) => {
        this.activeDownloads.delete(key);
        this.failedDownloads.add(key);
        log.e("Player", `Download failed: ${key}`, error instanceof Error ? error : undefined);
        return null;
      });

    this.activeDownloads.set(key, downloadPromise);
    return downloadPromise;
  }

  // ─── Prefetch Ahead Pipeline ───────────────────────────────────────

  private async prefetchAhead() {
    if (!this.reciterId) return;

    const startIdx = this.queueIndex + 1;
    const endIdx = Math.min(startIdx + PREFETCH_AHEAD, this.queue.length);

    for (let i = startIdx; i < endIdx; i++) {
      const item = this.queue[i];
      if (!item || !item.audioFile || item.localPath) continue;

      const localPath = await this.resolveLocalPath(
        this.reciterId,
        item.thikrId,
        item.audioFile.url,
        item.audioFile.size
      );
      if (localPath) {
        item.localPath = localPath;
      }
    }

    // Preload next track into buffer player
    await this.preloadNextIntoBuffer();
  }

  private async preloadNextIntoBuffer() {
    if (!this.reciterId) return;
    const buffer = this.bufferPlayer;
    if (!buffer) return;

    const nextItem = this.queue[this.queueIndex + 1];
    if (!nextItem) {
      this.invalidateBuffer();
      return;
    }

    // Already preloaded
    if (this.bufferThikrId === nextItem.thikrId && this.bufferLocalPath) {
      return;
    }

    let localPath = nextItem.localPath;
    if (!localPath && nextItem.audioFile) {
      localPath = await this.resolveLocalPath(
        this.reciterId,
        nextItem.thikrId,
        nextItem.audioFile.url,
        nextItem.audioFile.size
      );
      if (localPath) nextItem.localPath = localPath;
    }

    if (!localPath) {
      this.invalidateBuffer();
      return;
    }

    try {
      // Pause buffer player before replace
      try {
        buffer.pause();
      } catch {
        // safe
      }
      buffer.replace({ uri: localPath });
      this.bufferThikrId = nextItem.thikrId;
      this.bufferLocalPath = localPath;
      log.d("Player", `Preloaded ${nextItem.thikrId} into buffer`);
    } catch (error) {
      log.e("Player", "Preload error", error instanceof Error ? error : undefined);
      this.invalidateBuffer();
    }
  }

  private invalidateBuffer() {
    this.bufferThikrId = null;
    this.bufferLocalPath = null;
  }

  // ─── Helpers ───────────────────────────────────────────────────────

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
    const player = this.activePlayer;
    if (!player || !this.reciterId) return;

    const metadata = this.metadataResolver
      ? this.metadataResolver(item.thikrId, this.reciterId)
      : { title: item.thikrId, artist: this.reciterId };

    try {
      player.setActiveForLockScreen(true, metadata, {
        showSeekForward: false,
        showSeekBackward: false,
      });
    } catch (error) {
      log.e("Player", "Lock screen error", error instanceof Error ? error : undefined);
    }
  }

  private clearAdvanceTimer() {
    if (this.advanceTimer) {
      clearTimeout(this.advanceTimer);
      this.advanceTimer = null;
    }
  }

  // ─── Getters ───────────────────────────────────────────────────────

  getState(): MachineState {
    return this.state;
  }

  getCurrentQueueIndex(): number {
    return this.queueIndex;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  isActive(): boolean {
    return this.state !== "idle" && this.state !== "error";
  }

  // ─── Unmount ───────────────────────────────────────────────────────

  notifyPlayerUnmount() {
    if (!this.mounted) return;

    this.clearAdvanceTimer();
    this.clearCrossfadeTimer();
    this.handlingEnd = false;

    // Do not call pause() on players during unmount — expo-audio
    // destroys native objects, so calling methods races with cleanup
    this.state = "idle";
    this.onStateChange?.("idle");

    log.i("Player", "Stopped (unmount)");
    this.queue = [];
    this.queueIndex = 0;
    this.currentRepeat = 0;
    this.onThikrChange?.(null, 0, 0);
    this.refA = null;
    this.refB = null;
    this.mounted = false;
    this.invalidateBuffer();
    this.activeDownloads.clear();
    this.failedDownloads.clear();
  }
}

export const athkarPlayer = AthkarPlayer.getInstance();
