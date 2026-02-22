import { Appearance, Image } from "react-native";
import TrackPlayer, { Capability, RepeatMode } from "react-native-track-player";
import type { Track } from "react-native-track-player";

import { SMART_PAUSE, getThikrId } from "@/constants/AthkarAudio";
import { audioDownloadManager } from "@/services/athkar-audio-download";
import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { useAthkarStore } from "@/stores/athkar";
import { reciterRegistry } from "@/services/athkar-reciter-registry";
import { AppLogger } from "@/utils/appLogger";
import type { PlayerState, ReciterManifest, QueueItem } from "@/types/athkar-audio";
import type { Athkar } from "@/types/athkar";

const log = AppLogger.create("athkar-audio");

const PREFETCH_AHEAD = 3;

class AthkarPlayer {
  private static instance: AthkarPlayer;
  private initialized = false;

  // Queue (JS-side: one entry per thikr, NOT per repeat)
  private queue: QueueItem[] = [];
  private uniqueThikrIds: string[] = [];
  private sessionType: "morning" | "evening" = "morning";
  private reciterId: string | null = null;
  private manifest: ReciterManifest | null = null;

  // Track state for counting and smart pause
  private previousAthkarId: string | null = null;
  private previousDuration = 0;
  private isManualSkip = false;
  private isSmartPausing = false;

  // Timers
  private smartPauseTimer: NodeJS.Timeout | null = null;

  // Download dedup
  private activeDownloads: Map<string, Promise<string | null>> = new Map();
  private failedDownloads: Set<string> = new Set();

  private constructor() {}

  static getInstance(): AthkarPlayer {
    if (!AthkarPlayer.instance) {
      AthkarPlayer.instance = new AthkarPlayer();
    }
    return AthkarPlayer.instance;
  }

  // ─── Store Access Helpers ─────────────────────────────────────────

  private get store() {
    return useAthkarAudioStore.getState();
  }

  private get athkarStore() {
    return useAthkarStore.getState();
  }

  private setPlayerState(state: PlayerState) {
    this.store.setPlayerState(state);
  }

  // ─── Initialize ───────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await TrackPlayer.setupPlayer({
        autoHandleInterruptions: true,
      });
      await TrackPlayer.updateOptions({
        progressUpdateEventInterval: 1,
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.Stop,
          Capability.SeekTo,
        ],
        compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],
      });
      this.initialized = true;
      log.i("Player", "TrackPlayer initialized");
    } catch (error) {
      if ((error as Error)?.message?.includes("already been initialized")) {
        this.initialized = true;
        log.i("Player", "TrackPlayer was already initialized");
      } else {
        log.e("Player", "TrackPlayer init failed", error instanceof Error ? error : undefined);
        throw error;
      }
    }
  }

  // ─── Queue Building ────────────────────────────────────────────────

  async buildQueue(
    athkarList: Athkar[],
    manifest: ReciterManifest,
    reciterId: string,
    sessionType: "morning" | "evening"
  ): Promise<void> {
    await this.initialize();

    this.reciterId = reciterId;
    this.manifest = manifest;
    this.sessionType = sessionType;
    this.previousAthkarId = null;
    this.previousDuration = 0;
    this.isManualSkip = false;
    this.isSmartPausing = false;
    this.clearSmartPauseTimer();

    // Build JS queue (one entry per thikr)
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
      const totalRepeats = athkar.count;

      return {
        athkarId: athkar.id,
        thikrId: thikrId ?? athkar.id,
        totalRepeats,
        audioFile,
        localPath: null,
      };
    });

    // Track unique athkar IDs for session progress display
    this.uniqueThikrIds = [];
    const seen = new Set<string>();
    for (const item of this.queue) {
      if (!seen.has(item.athkarId)) {
        seen.add(item.athkarId);
        this.uniqueThikrIds.push(item.athkarId);
      }
    }

    // Resolve local paths and build RNTP tracks (expanded: one track per repeat)
    const tracks: Track[] = [];
    let trackCounter = 0;
    for (let i = 0; i < this.queue.length; i++) {
      const item = this.queue[i];
      if (!item.audioFile) continue;

      const localPath = await this.resolveLocalPath(
        reciterId,
        item.thikrId,
        item.audioFile.url,
        item.audioFile.size
      );
      if (!localPath) continue;

      item.localPath = localPath;

      const effectiveRepeats = this.getEffectiveRepeats(item);

      for (let r = 0; r < effectiveRepeats; r++) {
        tracks.push({
          id: `t${trackCounter++}`,
          url: localPath,
          title: this.getSessionTitle(),
          artist: this.getReciterName(),
          artwork: this.getArtworkUrl(),
          thikrId: item.thikrId,
          athkarId: item.athkarId,
          repeatIndex: r,
          totalRepeats: effectiveRepeats,
        });
      }
    }

    if (tracks.length === 0) {
      log.w("Player", "No tracks available for queue");
      return;
    }

    await TrackPlayer.reset();
    await TrackPlayer.add(tracks);
    await TrackPlayer.setRepeatMode(RepeatMode.Off);

    // Update store
    this.store.setSessionProgress({ current: 1, total: this.uniqueThikrIds.length });
    this.store.setCurrentTrack(this.queue[0]?.thikrId ?? null, this.queue[0]?.athkarId ?? null);
    this.store.setRepeatProgress({
      current: 0,
      total: this.getEffectiveRepeats(this.queue[0]),
    });

    log.i(
      "Player",
      `Queue built: ${tracks.length} tracks (${this.uniqueThikrIds.length} thikrs) for ${sessionType}`
    );
  }

  // ─── Playback Control ──────────────────────────────────────────────

  async play(): Promise<void> {
    await this.initialize();
    this.setPlayerState("playing");
    await TrackPlayer.play();
  }

  async pause(): Promise<void> {
    this.setPlayerState("paused");
    await TrackPlayer.pause();
  }

  async next(): Promise<void> {
    this.clearSmartPauseTimer();

    const currentIndex = await TrackPlayer.getActiveTrackIndex();
    const queue = await TrackPlayer.getQueue();
    if (currentIndex === undefined || currentIndex === null) return;

    const currentAthkarId = queue[currentIndex]?.athkarId;

    // Skip past all remaining repeats of the current thikr
    let nextIndex = currentIndex + 1;
    while (nextIndex < queue.length && queue[nextIndex].athkarId === currentAthkarId) {
      nextIndex++;
    }

    if (nextIndex < queue.length) {
      this.isManualSkip = true;
      try {
        await TrackPlayer.skip(nextIndex);
        await TrackPlayer.play();
        this.setPlayerState("playing");
      } catch (error) {
        log.w("Player", `next skip failed: ${(error as Error)?.message}`);
      }
    } else {
      await this.handleSessionComplete();
    }
  }

  async previous(): Promise<void> {
    this.clearSmartPauseTimer();

    const currentIndex = await TrackPlayer.getActiveTrackIndex();
    const queue = await TrackPlayer.getQueue();
    if (currentIndex === undefined || currentIndex === null) return;

    const currentAthkarId = queue[currentIndex]?.athkarId;

    // Find first repeat of current athkarId
    let firstRepeatIndex = currentIndex;
    while (firstRepeatIndex > 0 && queue[firstRepeatIndex - 1]?.athkarId === currentAthkarId) {
      firstRepeatIndex--;
    }

    if (firstRepeatIndex < currentIndex) {
      // Go back to first repeat of current thikr
      this.isManualSkip = true;
      try {
        await TrackPlayer.skip(firstRepeatIndex);
        await TrackPlayer.play();
        this.setPlayerState("playing");
      } catch (error) {
        log.w("Player", `previous skip failed: ${(error as Error)?.message}`);
      }
    } else if (firstRepeatIndex > 0) {
      // Already at first repeat — go to first repeat of previous thikr
      const prevAthkarId = queue[firstRepeatIndex - 1]?.athkarId;
      let prevFirstIndex = firstRepeatIndex - 1;
      while (prevFirstIndex > 0 && queue[prevFirstIndex - 1]?.athkarId === prevAthkarId) {
        prevFirstIndex--;
      }
      this.isManualSkip = true;
      try {
        await TrackPlayer.skip(prevFirstIndex);
        await TrackPlayer.play();
        this.setPlayerState("playing");
      } catch (error) {
        log.w("Player", `previous skip failed: ${(error as Error)?.message}`);
      }
    } else {
      await TrackPlayer.seekTo(0);
    }
  }

  async stop(): Promise<void> {
    this.clearSmartPauseTimer();

    await TrackPlayer.reset();

    this.queue = [];
    this.uniqueThikrIds = [];
    this.previousAthkarId = null;
    this.previousDuration = 0;
    this.isManualSkip = false;
    this.isSmartPausing = false;
    this.activeDownloads.clear();
    this.failedDownloads.clear();

    this.store.resetPlaybackState();
    log.i("Player", "Stopped");
  }

  async seekTo(seconds: number): Promise<void> {
    await TrackPlayer.seekTo(seconds);
    this.store.setPosition(seconds);
  }

  async jumpTo(athkarId: string): Promise<void> {
    const rnQueue = await TrackPlayer.getQueue();

    // Collect all RNTP tracks for this athkarId
    const matchingIndices: number[] = [];
    for (let i = 0; i < rnQueue.length; i++) {
      if (rnQueue[i].athkarId === athkarId) matchingIndices.push(i);
    }

    if (matchingIndices.length === 0) {
      log.w("Player", `jumpTo: athkarId ${athkarId} not found in queue`);
      return;
    }

    // Use current count to resume at the right track (skip already-completed ones)
    const progressItem = this.athkarStore.currentProgress.find((p) => p.athkarId === athkarId);
    const currentCount = progressItem?.currentCount ?? 0;
    const offset = Math.min(currentCount, matchingIndices.length - 1);
    const targetIndex = matchingIndices[offset];

    this.clearSmartPauseTimer();
    this.isManualSkip = true;

    try {
      await TrackPlayer.skip(targetIndex);
      await TrackPlayer.play();
      this.setPlayerState("playing");
    } catch (error) {
      log.w("Player", `jumpTo skip/play failed: ${(error as Error)?.message}`);
    }
  }

  async startAndJumpTo(athkarId: string): Promise<void> {
    const rnQueue = await TrackPlayer.getQueue();
    if (rnQueue.length > 0) {
      await this.jumpTo(athkarId);
      return;
    }

    const { selectedReciterId } = this.store;
    if (!selectedReciterId) {
      log.w("Player", "startAndJumpTo: no reciter selected");
      return;
    }

    const { currentType, morningAthkarList, eveningAthkarList } = this.athkarStore;
    const athkarList = currentType === "morning" ? morningAthkarList : eveningAthkarList;

    const manifest = await reciterRegistry.fetchManifest(selectedReciterId);
    if (!manifest) {
      log.w("Player", "startAndJumpTo: failed to fetch manifest");
      return;
    }

    this.setPlayerState("loading");
    await this.buildQueue(athkarList, manifest, selectedReciterId, currentType);
    await this.jumpTo(athkarId);
  }

  // ─── Event Handlers (called by PlaybackService) ────────────────────

  async handleTrackChanged(event: { track?: Track | null; index?: number | null }): Promise<void> {
    const { track, index } = event;
    if (!track || index === null || index === undefined) return;

    // Skip non-athkar tracks (e.g. sound previews)
    if (!track.athkarId) return;

    const thikrId = track.thikrId as string;
    const athkarId = track.athkarId as string;
    const repeatIndex = (track.repeatIndex as number) ?? 0;
    const totalRepeats = (track.totalRepeats as number) ?? 1;
    const wasManualSkip = this.isManualSkip;
    this.isManualSkip = false;

    // On natural advance: increment count for the completed track
    if (!wasManualSkip && this.previousAthkarId) {
      this.athkarStore.incrementCount(this.previousAthkarId);
    }

    // Smart pause when transitioning to a different thikr (natural advance only)
    if (!wasManualSkip && this.previousAthkarId && this.previousAthkarId !== athkarId) {
      const pauseMs = this.getSmartPause(this.previousDuration);
      if (pauseMs > 0) {
        this.isSmartPausing = true;
        await TrackPlayer.pause();
        this.setPlayerState("loading");
        await new Promise((resolve) => {
          this.smartPauseTimer = setTimeout(resolve, pauseMs);
        });
        this.smartPauseTimer = null;
        await TrackPlayer.play();
        this.setPlayerState("playing");
        this.isSmartPausing = false;
      }
    }

    // Update store
    this.store.setCurrentTrack(thikrId, athkarId);
    this.store.setRepeatProgress({ current: repeatIndex, total: totalRepeats });

    // Session progress (unique thikr position, not raw RNTP index)
    const thikrNumber = this.uniqueThikrIds.indexOf(athkarId);
    if (thikrNumber !== -1) {
      this.store.setSessionProgress({
        current: thikrNumber + 1,
        total: this.uniqueThikrIds.length,
      });
    }

    // Sync athkar store index when thikr changes
    if (athkarId !== this.previousAthkarId) {
      const {
        currentType,
        morningAthkarList,
        eveningAthkarList,
        currentAthkarIndex,
        setCurrentAthkarIndex,
      } = this.athkarStore;
      const list = currentType === "morning" ? morningAthkarList : eveningAthkarList;
      const idx = list.findIndex((a) => a.id === athkarId);
      if (idx !== -1 && idx !== currentAthkarIndex) {
        setCurrentAthkarIndex(idx);
      }
    }

    this.previousAthkarId = athkarId;

    // Prefetch upcoming audio files
    const jsQueueIdx = this.queue.findIndex((q) => q.athkarId === athkarId);
    if (jsQueueIdx !== -1) {
      this.prefetchAhead(jsQueueIdx);
    }

    log.d("Player", `Track: ${thikrId} repeat ${repeatIndex + 1}/${totalRepeats} (index ${index})`);
  }

  handleProgressUpdate(event: { position: number; duration: number; buffered: number }): void {
    if (this.queue.length === 0) return;

    this.store.setPosition(event.position);
    if (event.duration > 0) {
      this.store.setDuration(event.duration);
      this.previousDuration = event.duration;
    }
  }

  handlePlayWhenReadyChanged(event: { playWhenReady: boolean }): void {
    if (this.queue.length === 0) return;
    if (this.isSmartPausing) return;

    if (event.playWhenReady) {
      this.setPlayerState("playing");
    } else {
      const currentState = this.store.playerState;
      if (currentState === "playing") {
        this.setPlayerState("paused");
      }
    }
  }

  async handleQueueEnded(_event: { track?: number; position: number }): Promise<void> {
    if (this.queue.length === 0) return;

    // Increment count for the last track in the session
    if (this.previousAthkarId) {
      this.athkarStore.incrementCount(this.previousAthkarId);
    }

    await this.handleSessionComplete();
  }

  handlePlaybackError(event: { code?: string; message?: string }): void {
    log.e(
      "Player",
      `Playback error: ${event.code ?? "unknown"} — ${event.message ?? "no message"}`
    );
  }

  // ─── Session Complete ──────────────────────────────────────────────

  async handleSessionComplete(): Promise<void> {
    log.i("Player", "Session complete");
    await TrackPlayer.reset();

    this.queue = [];
    this.uniqueThikrIds = [];
    this.previousAthkarId = null;
    this.previousDuration = 0;
    this.isManualSkip = false;
    this.isSmartPausing = false;
    this.clearSmartPauseTimer();

    this.store.setPlayerState("idle");
    this.store.setShowCompletion(true);
    this.store.setCurrentTrack(null, null);
  }

  // ─── Download & Prefetch ───────────────────────────────────────────

  private async resolveLocalPath(
    reciterId: string,
    thikrId: string,
    url: string,
    size: number
  ): Promise<string | null> {
    const existing = await audioDownloadManager.getLocalPath(reciterId, thikrId);
    if (existing) return existing;

    const key = `${reciterId}/${thikrId}`;
    if (this.failedDownloads.has(key)) return null;

    if (this.activeDownloads.has(key)) {
      return this.activeDownloads.get(key)!;
    }

    const downloadPromise = audioDownloadManager
      .downloadFile(reciterId, thikrId, url, size)
      .then((result) => {
        this.activeDownloads.delete(key);
        if (!result) this.failedDownloads.add(key);
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

  private async prefetchAhead(currentQueueIndex: number): Promise<void> {
    if (!this.reciterId || !this.manifest) return;

    const startIdx = currentQueueIndex + 1;
    const endIdx = Math.min(startIdx + PREFETCH_AHEAD, this.queue.length);

    for (let i = startIdx; i < endIdx; i++) {
      const item = this.queue[i];
      if (!item?.audioFile || item.localPath) continue;

      const localPath = await this.resolveLocalPath(
        this.reciterId,
        item.thikrId,
        item.audioFile.url,
        item.audioFile.size
      );
      if (localPath) item.localPath = localPath;
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private getEffectiveRepeats(item: QueueItem | undefined): number {
    if (!item) return 0;
    const repeatLimit = this.store.repeatLimit;
    if (repeatLimit === "all") return item.totalRepeats;
    return Math.min(repeatLimit as number, item.totalRepeats);
  }

  private getSmartPause(audioDuration: number): number {
    if (audioDuration < SMART_PAUSE.SHORT_THRESHOLD) return SMART_PAUSE.SHORT_PAUSE;
    if (audioDuration < SMART_PAUSE.LONG_THRESHOLD) return SMART_PAUSE.MEDIUM_PAUSE;
    return SMART_PAUSE.LONG_PAUSE;
  }

  private getSessionTitle(): string {
    return this.sessionType === "morning" ? "Morning Athkar" : "Evening Athkar";
  }

  private getReciterName(): string {
    if (!this.reciterId) return "";
    const catalog = reciterRegistry.getCachedCatalog();
    if (!catalog) return this.reciterId;
    const reciter = catalog.reciters.find((r) => r.id === this.reciterId);
    if (!reciter) return this.reciterId;
    return reciter.name["ar"] ?? reciter.name["en"] ?? this.reciterId;
  }

  private getArtworkUrl(): string | undefined {
    try {
      const isDark = Appearance.getColorScheme() === "dark";
      const icon = isDark
        ? Image.resolveAssetSource(require("../../assets/images/ios-dark.png"))
        : Image.resolveAssetSource(require("../../assets/images/icon.png"));
      return icon?.uri;
    } catch {
      return undefined;
    }
  }

  private clearSmartPauseTimer() {
    if (this.smartPauseTimer) {
      clearTimeout(this.smartPauseTimer);
      this.smartPauseTimer = null;
    }
  }

  // ─── Getters ───────────────────────────────────────────────────────

  isActive(): boolean {
    const state = this.store.playerState;
    return state !== "idle" && state !== "ended";
  }

  getCurrentAthkarId(): string | null {
    return this.store.currentAthkarId;
  }
}

export const athkarPlayer = AthkarPlayer.getInstance();
