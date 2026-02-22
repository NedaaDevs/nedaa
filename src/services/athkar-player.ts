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

  // Queue (JS-side tracking -- RNTP has its own queue but we need metadata)
  private queue: QueueItem[] = [];
  private currentRepeat = 0;
  private sessionType: "morning" | "evening" = "morning";
  private reciterId: string | null = null;
  private manifest: ReciterManifest | null = null;

  // Timers
  private smartPauseTimer: ReturnType<typeof setTimeout> | null = null;
  private handlingEnd = false;

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
    this.currentRepeat = 0;
    this.handlingEnd = false;
    this.clearSmartPauseTimer();

    // Build JS queue
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

    // Resolve local paths and build RNTP tracks
    const tracks: Track[] = [];
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

      tracks.push({
        id: item.athkarId,
        url: localPath,
        title: this.getSessionTitle(),
        artist: this.getReciterName(),
        artwork: this.getArtworkUrl(),
        thikrId: item.thikrId,
        athkarId: item.athkarId,
        totalRepeats: effectiveRepeats,
        queueIndex: i,
      });
    }

    if (tracks.length === 0) {
      log.w("Player", "No tracks available for queue");
      return;
    }

    await TrackPlayer.reset();
    await TrackPlayer.add(tracks);
    await TrackPlayer.setRepeatMode(RepeatMode.Track);

    // Update store
    this.store.setSessionProgress({ current: 1, total: tracks.length });
    this.store.setCurrentTrack(this.queue[0]?.thikrId ?? null, this.queue[0]?.athkarId ?? null);
    this.store.setRepeatProgress({
      current: 0,
      total: this.getEffectiveRepeats(this.queue[0]),
    });

    log.i("Player", `Queue built: ${tracks.length} tracks for ${sessionType}`);
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
    this.handlingEnd = false;
    this.currentRepeat = 0;

    const currentIndex = await TrackPlayer.getActiveTrackIndex();
    const queue = await TrackPlayer.getQueue();

    if (currentIndex !== undefined && currentIndex !== null && currentIndex < queue.length - 1) {
      await TrackPlayer.skipToNext();
    } else {
      await this.handleSessionComplete();
    }
  }

  async previous(): Promise<void> {
    this.clearSmartPauseTimer();
    this.handlingEnd = false;
    this.currentRepeat = 0;

    const currentIndex = await TrackPlayer.getActiveTrackIndex();

    if (currentIndex !== undefined && currentIndex !== null && currentIndex > 0) {
      await TrackPlayer.skipToPrevious();
    } else {
      await TrackPlayer.seekTo(0);
    }
  }

  async stop(): Promise<void> {
    this.clearSmartPauseTimer();
    this.handlingEnd = false;
    this.currentRepeat = 0;

    await TrackPlayer.reset();

    this.queue = [];
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
    const trackIndex = rnQueue.findIndex((t) => t.id === athkarId);

    if (trackIndex === -1) {
      log.w("Player", `jumpTo: athkarId ${athkarId} not found in queue`);
      return;
    }

    this.clearSmartPauseTimer();
    this.handlingEnd = false;
    this.currentRepeat = 0;

    await TrackPlayer.skip(trackIndex);
    await TrackPlayer.play();
    this.setPlayerState("playing");
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

    this.currentRepeat = 0;
    this.handlingEnd = false;

    const thikrId = track.thikrId as string | undefined;
    const athkarId = track.athkarId as string | undefined;
    const totalRepeats = track.totalRepeats as number | undefined;
    const queueIndex = track.queueIndex as number | undefined;

    if (thikrId && athkarId) {
      this.store.setCurrentTrack(thikrId, athkarId);
    }
    if (totalRepeats) {
      this.store.setRepeatProgress({ current: 0, total: totalRepeats });
    }

    const rnQueue = await TrackPlayer.getQueue();
    this.store.setSessionProgress({
      current: index + 1,
      total: rnQueue.length,
    });

    // Sync athkar store index
    if (athkarId) {
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

    // Prefetch upcoming tracks
    this.prefetchAhead(queueIndex ?? index);

    log.d("Player", `Track changed: ${thikrId} (index ${index})`);
  }

  handleProgressUpdate(event: { position: number; duration: number; buffered: number }): void {
    if (this.queue.length === 0) return;

    this.store.setPosition(event.position);
    if (event.duration > 0) {
      this.store.setDuration(event.duration);
    }

    // Reset handlingEnd when position wraps back to start (RepeatMode.Track looped)
    if (this.handlingEnd && event.position < 1 && event.duration > 1) {
      this.handlingEnd = false;
    }

    // Detect natural track completion for repeat handling
    if (event.duration > 0 && event.position >= event.duration - 0.3 && !this.handlingEnd) {
      this.handleRepeatOrAdvance();
    }
  }

  handlePlayWhenReadyChanged(event: { playWhenReady: boolean }): void {
    if (this.queue.length === 0) return;
    if (this.handlingEnd) return;

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
    if (this.handlingEnd) return;

    // Check if this is truly the end (last repeat of last track)
    const activeTrack = await TrackPlayer.getActiveTrack();
    if (activeTrack) {
      const totalRepeats = (activeTrack.totalRepeats as number) ?? 1;
      if (this.currentRepeat < totalRepeats - 1) {
        return;
      }
    }

    await this.handleSessionComplete();
  }

  // ─── Repeat Handling ───────────────────────────────────────────────

  private async handleRepeatOrAdvance(): Promise<void> {
    if (this.handlingEnd) return;
    this.handlingEnd = true;

    const activeTrack = await TrackPlayer.getActiveTrack();
    if (!activeTrack) {
      this.handlingEnd = false;
      return;
    }

    const totalRepeats = (activeTrack.totalRepeats as number) ?? 1;
    const athkarId = activeTrack.athkarId as string | undefined;

    // Increment counter in athkar store
    if (athkarId) {
      this.athkarStore.incrementCount(athkarId);
    }

    this.currentRepeat++;
    this.store.setRepeatProgress({
      current: this.currentRepeat,
      total: totalRepeats,
    });

    if (this.currentRepeat < totalRepeats) {
      // More repeats — RepeatMode.Track handles the loop natively
      // handlingEnd stays true until position wraps back to start
      log.d("Player", `Repeat ${this.currentRepeat + 1}/${totalRepeats}`);
    } else {
      // All repeats done — pause to stop the RepeatMode.Track loop
      await TrackPlayer.pause();
      const duration = (activeTrack.duration as number) ?? 0;
      const pauseMs = this.getSmartPause(duration);

      if (pauseMs > 0) {
        this.setPlayerState("loading");
        this.smartPauseTimer = setTimeout(async () => {
          await this.advanceToNextTrack();
        }, pauseMs);
      } else {
        await this.advanceToNextTrack();
      }
    }
  }

  private async advanceToNextTrack(): Promise<void> {
    const currentIndex = await TrackPlayer.getActiveTrackIndex();
    const queue = await TrackPlayer.getQueue();

    if (currentIndex !== undefined && currentIndex !== null && currentIndex < queue.length - 1) {
      this.currentRepeat = 0;
      this.handlingEnd = false;
      await TrackPlayer.skipToNext();
      await TrackPlayer.play();
      this.setPlayerState("playing");
    } else {
      await this.handleSessionComplete();
    }
  }

  async handleSessionComplete(): Promise<void> {
    log.i("Player", "Session complete");
    await TrackPlayer.reset();

    this.queue = [];
    this.currentRepeat = 0;
    this.handlingEnd = false;
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
