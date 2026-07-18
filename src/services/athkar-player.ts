import { TrackPlayer, PlayerQueue } from "react-native-nitro-player";
import type { TrackItem, TrackPlayerState } from "react-native-nitro-player";

import { SMART_PAUSE, getThikrId } from "@/constants/AthkarAudio";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { nitroSession } from "@/services/audio/nitroSession";
import { audioDownloadManager } from "@/services/athkar-audio-download";
import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { useAthkarStore } from "@/stores/athkar";
import { reciterRegistry, getLocalizedName } from "@/services/athkar-reciter-registry";
import { AppLogger } from "@/utils/appLogger";
import { resolveNowPlayingArtwork } from "@/utils/nowPlayingArtwork";
import { PLAYER_STATE, type PlayerState, type ReciterManifest } from "@/types/athkar-audio";
import type { Athkar, AthkarType } from "@/types/athkar";
import i18n from "@/localization/i18n";

type SessionType = Exclude<AthkarType, typeof ATHKAR_TYPE.ALL>;

const log = AppLogger.create("athkar-audio");

// One recitation of one audio file. The plan is the flat sequence of steps; a
// non-group athkar is a single step whose file loops `repeatTarget` times, a
// group athkar expands to one step per (round × audio). Repeats are NOT expanded
// into separate queue entries — the count lives here, not in the native queue.
type Step = {
  athkarId: string;
  thikrId: string;
  url: string;
  repeatTarget: number;
  isGroup: boolean;
};

// A backward jump larger than this (seconds) means the current file looped —
// RepeatMode.track restarts it at 0, so one repeat finished.
const LOOP_WRAP_DROP = 0.5;

// Drives the athkar session. The player is a dumb audio engine: it plays and
// loops the current file (RepeatMode.track) and reports progress. This service
// owns everything meaningful — which athkar, repeat counting, smart pause,
// advancement, and session completion — and only ever tells the player which
// file to play. Player lifecycle events never decide session state.
class AthkarPlayer {
  private static instance: AthkarPlayer;
  private initialized = false;

  // Native playlist of the unique step files (deleted on rebuild/stop).
  private playlistId: string | null = null;

  private sessionType: SessionType = ATHKAR_TYPE.MORNING;
  private reciterId: string | null = null;
  private manifest: ReciterManifest | null = null;

  // The session plan and our position within it — the source of truth.
  private plan: Step[] = [];
  private stepIndex = 0;
  private repeatDone = 0;
  private uniqueAthkarIds: string[] = [];

  private lastPosition = 0;
  private stepDuration = 0;
  // True while we reposition the player ourselves, so the resulting progress
  // reset and track-change aren't misread as a loop or an external skip.
  private advancing = false;
  private isSmartPausing = false;
  private userStopping = false;

  private smartPauseTimer: ReturnType<typeof setTimeout> | null = null;

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
    this.athkarStore.setPlayerState(state);
  }

  private indexOf(track: TrackItem): number {
    // Track ids are `t<stepIndex>`, assigned in plan order at build time.
    return Number(track.id.slice(1));
  }

  // ─── Initialize ───────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      nitroSession.register("athkar", {
        onChangeTrack: (track) => this.onChangeTrack(track),
        onPlaybackStateChange: (state) => this.onPlaybackStateChange(state),
        onProgress: (position, duration, seeked) => this.onProgress(position, duration, seeked),
        // Another owner took the player — drop this session. Returned so the
        // incoming owner waits for teardown before loading its own queue.
        onEvict: () => this.teardown(),
      });
      await nitroSession.ensureStarted();
      this.initialized = true;
      await this.syncRate();
      log.d("Player", "athkar player initialized");
    } catch (error) {
      log.e("Player", "init failed", error instanceof Error ? error : undefined);
      throw error;
    }
  }

  // ─── Queue Building ────────────────────────────────────────────────

  async buildQueue(
    athkarList: Athkar[],
    manifest: ReciterManifest,
    reciterId: string,
    sessionType: SessionType
  ): Promise<void> {
    await this.initialize();
    await nitroSession.acquire("athkar");

    this.reciterId = reciterId;
    this.manifest = manifest;
    this.sessionType = sessionType;
    this.clearSmartPauseTimer();
    this.isSmartPausing = false;
    this.advancing = false;
    this.stepIndex = 0;
    this.repeatDone = 0;
    this.lastPosition = 0;
    this.stepDuration = 0;

    // Build the plan: one step per file, repeats kept as a count (not expanded).
    const plan: Step[] = [];
    for (const athkar of athkarList) {
      if (athkar.group) {
        const rounds = Math.ceil(athkar.count / athkar.group.itemsPerRound);
        for (let round = 0; round < rounds; round++) {
          for (const audioId of athkar.group.audioIds) {
            const file = manifest.files[audioId];
            if (!file) continue;
            const local = await audioDownloadManager.getLocalPath(reciterId, audioId);
            plan.push({
              athkarId: athkar.id,
              thikrId: audioId,
              url: local ?? file.url,
              repeatTarget: 1,
              isGroup: true,
            });
          }
        }
        continue;
      }

      const thikrId = getThikrId(athkar.order, sessionType) ?? athkar.id;
      const file = manifest.files[thikrId];
      if (!file) continue;
      const local = await audioDownloadManager.getLocalPath(reciterId, thikrId);
      plan.push({
        athkarId: athkar.id,
        thikrId,
        url: local ?? file.url,
        repeatTarget: this.getEffectiveRepeats(athkar.count),
        isGroup: false,
      });
    }

    if (plan.length === 0) {
      log.w("Player", "No tracks available for queue");
      return;
    }

    this.plan = plan;
    this.uniqueAthkarIds = [];
    const seen = new Set<string>();
    for (const step of plan) {
      if (!seen.has(step.athkarId)) {
        seen.add(step.athkarId);
        this.uniqueAthkarIds.push(step.athkarId);
      }
    }

    // Native queue = the plain step files, no recitation metadata.
    const title = this.getSessionTitle();
    const artist = this.getReciterName();
    const artwork = resolveNowPlayingArtwork();
    const tracks: TrackItem[] = plan.map((step, i) => ({
      id: `t${i}`,
      title,
      artist,
      album: "",
      duration: 0,
      url: step.url,
      artwork,
    }));

    if (this.playlistId) {
      await PlayerQueue.deletePlaylist(this.playlistId).catch(() => {});
    }
    const pid = await PlayerQueue.createPlaylist(`athkar-${sessionType}`);
    await PlayerQueue.addTracksToPlaylist(pid, tracks);
    await PlayerQueue.loadPlaylist(pid);
    // Loop the current file; we advance to the next step explicitly once its
    // repeats are counted. The player never auto-advances on its own.
    await TrackPlayer.setRepeatMode("track");
    await this.syncRate();
    this.playlistId = pid;

    const first = plan[0];
    this.athkarStore.setSessionProgress({ current: 1, total: this.uniqueAthkarIds.length });
    this.athkarStore.setCurrentTrack(first.thikrId, first.athkarId);
    this.athkarStore.setRepeatProgress({ current: 0, total: first.repeatTarget });
    this.computeGroupProgress(first.athkarId, first.thikrId);

    // Streaming (undownloaded) files are a common stall/error source — record how
    // many so a shared log shows whether playback ran off local files or the CDN.
    const streamed = plan.filter((s) => s.url === manifest.files[s.thikrId]?.url).length;
    log.i(
      "Player",
      `Queue built: ${plan.length} steps, ${this.uniqueAthkarIds.length} thikrs, ${sessionType}, ` +
        `reciter=${reciterId}, ${streamed > 0 ? `${streamed}/${plan.length} streamed` : "all local"}`
    );
  }

  // ─── Playback Control ──────────────────────────────────────────────

  async play(): Promise<void> {
    await this.initialize();
    await TrackPlayer.play();
  }

  async pause(): Promise<void> {
    await TrackPlayer.pause();
  }

  async next(): Promise<void> {
    if (!this.playlistId) return;
    this.clearSmartPauseTimer();
    const nextIndex = this.stepIndex + 1;
    if (nextIndex >= this.plan.length) {
      await this.completeSession();
      return;
    }
    await this.goToStep(nextIndex, this.plan[this.stepIndex].athkarId);
  }

  async previous(): Promise<void> {
    if (!this.playlistId) return;
    this.clearSmartPauseTimer();
    // Restart the current step if we're partway through it, else step back.
    if (this.repeatDone === 0 && this.lastPosition < 1.5 && this.stepIndex > 0) {
      await this.goToStep(this.stepIndex - 1, this.plan[this.stepIndex].athkarId);
    } else {
      await this.goToStep(this.stepIndex, this.plan[this.stepIndex].athkarId);
    }
  }

  async stop(): Promise<void> {
    this.userStopping = true;
    try {
      await TrackPlayer.pause();
      await this.teardown();
    } finally {
      this.userStopping = false;
    }
    log.i("Player", "Stopped");
  }

  async seekTo(seconds: number): Promise<void> {
    await TrackPlayer.seek(seconds);
    this.lastPosition = seconds;
    this.store.setPosition(seconds);
  }

  async setPlaybackRate(rate: number): Promise<void> {
    this.store.setPlaybackRate(rate);
    if (!this.initialized) return;
    try {
      await TrackPlayer.setPlaybackSpeed(rate);
    } catch (error) {
      log.w("Player", `setPlaybackSpeed failed: ${(error as Error)?.message}`);
    }
  }

  private async syncRate(): Promise<void> {
    try {
      await TrackPlayer.setPlaybackSpeed(this.store.playbackRate);
    } catch (error) {
      log.w("Player", `syncRate failed: ${(error as Error)?.message}`);
    }
  }

  async jumpTo(athkarId: string): Promise<void> {
    if (!this.playlistId) return;
    const stepIdxs: number[] = [];
    for (let i = 0; i < this.plan.length; i++) {
      if (this.plan[i].athkarId === athkarId) stepIdxs.push(i);
    }
    if (stepIdxs.length === 0) {
      log.w("Player", `jumpTo: athkarId ${athkarId} not found in plan`);
      return;
    }

    // Resume at the recitation matching the current count.
    const progressItem = this.athkarStore.currentProgress.find((p) => p.athkarId === athkarId);
    const currentCount = progressItem?.currentCount ?? 0;

    let target: number;
    let resumeRepeat = 0;
    if (this.plan[stepIdxs[0]].isGroup) {
      // Groups have one step per item — the count selects which item.
      target = stepIdxs[Math.min(currentCount, stepIdxs.length - 1)];
    } else {
      // Non-group is a single looping step — the count is how many repeats done.
      target = stepIdxs[0];
      resumeRepeat = Math.min(currentCount, this.plan[target].repeatTarget);
    }

    this.clearSmartPauseTimer();
    this.repeatDone = resumeRepeat;
    log.i(
      "Player",
      `Start: ${athkarId} @ step ${target}, repeat ${resumeRepeat}/${this.plan[target].repeatTarget}`
    );
    await this.playStep(target, true, null);
  }

  async startAndJumpTo(athkarId: string): Promise<void> {
    // Mark the tapped athkar as loading so its list card can show a spinner
    // immediately; cleared when the store leaves the loading state.
    this.athkarStore.setLoadingAthkarId(athkarId);
    if (this.playlistId) {
      await this.jumpTo(athkarId);
      return;
    }

    const { selectedReciterId } = this.store;
    if (!selectedReciterId) {
      log.w("Player", "startAndJumpTo: no reciter selected");
      return;
    }

    const { currentType, morningAthkarList, eveningAthkarList } = this.athkarStore;
    const athkarList = currentType === ATHKAR_TYPE.MORNING ? morningAthkarList : eveningAthkarList;

    const manifest = await reciterRegistry.fetchManifest(selectedReciterId);
    if (!manifest) {
      log.w("Player", "startAndJumpTo: failed to fetch manifest");
      return;
    }

    this.setPlayerState(PLAYER_STATE.LOADING);
    await this.buildQueue(athkarList, manifest, selectedReciterId, currentType);
    await this.jumpTo(athkarId);
  }

  // ─── Advancement (app-driven) ──────────────────────────────────────

  // Position the player on a step and play it. `athkarChanged` drives whether the
  // UI does a full athkar transition; `completedAthkarId` marks the prior athkar
  // done (for the completion animation) on a natural advance.
  private async playStep(
    index: number,
    athkarChanged: boolean,
    completedAthkarId: string | null
  ): Promise<void> {
    const step = this.plan[index];
    if (!step) return;
    this.stepIndex = index;
    this.lastPosition = 0;
    this.advancing = true;
    try {
      // Select then start: a lone command right after loadPlaylist is dropped
      // before the track is ready, so issue both.
      await TrackPlayer.playSong(`t${index}`, this.playlistId ?? undefined);
      await TrackPlayer.play();
    } catch (error) {
      log.w("Player", `playStep(${index}) failed: ${(error as Error)?.message}`);
    } finally {
      this.advancing = false;
    }
    this.syncUI(step, athkarChanged, completedAthkarId);
  }

  // Manual navigation (next/previous, lock screen): reposition without counting.
  private async goToStep(index: number, fromAthkarId: string): Promise<void> {
    this.repeatDone = 0;
    const changed = this.plan[index]?.athkarId !== fromAthkarId;
    await this.playStep(index, changed, null);
  }

  // One repeat of the current file finished (detected via a progress wrap).
  private async onRepeatComplete(): Promise<void> {
    const step = this.plan[this.stepIndex];
    if (!step) return;

    this.repeatDone += 1;
    this.athkarStore.incrementCount(step.athkarId, true);

    if (this.repeatDone < step.repeatTarget) {
      this.athkarStore.setRepeatProgress({ current: this.repeatDone, total: step.repeatTarget });
      this.computeGroupProgress(step.athkarId, step.thikrId);
      return;
    }

    // Step done — advance, or complete the session if it was the last.
    const nextIndex = this.stepIndex + 1;
    if (nextIndex >= this.plan.length) {
      await this.completeSession();
      return;
    }

    const prevAthkarId = step.athkarId;
    const next = this.plan[nextIndex];
    const athkarChanged = next.athkarId !== prevAthkarId;

    // Smart pause only between different athkar, matching the reading rhythm.
    if (athkarChanged) {
      const pauseMs = this.getSmartPause(this.stepDuration);
      if (pauseMs > 0) {
        this.isSmartPausing = true;
        this.setPlayerState(PLAYER_STATE.LOADING);
        await TrackPlayer.pause();
        await new Promise<void>((resolve) => {
          this.smartPauseTimer = setTimeout(() => resolve(), pauseMs);
        });
        this.smartPauseTimer = null;
        this.isSmartPausing = false;
      }
    }

    this.repeatDone = 0;
    log.d(
      "Player",
      `advance -> step ${nextIndex} ${next.thikrId}${athkarChanged ? " (new athkar)" : ""}`
    );
    await this.playStep(nextIndex, athkarChanged, athkarChanged ? prevAthkarId : null);
  }

  // ─── Native Event Handlers ─────────────────────────────────────────

  private onProgress(position: number, duration: number, seeked: boolean): void {
    if (!this.playlistId) return;
    this.store.setPosition(position);
    if (duration > 0) {
      this.store.setDuration(duration);
      this.stepDuration = duration;
    }

    if (this.advancing || this.isSmartPausing || seeked) {
      this.lastPosition = position;
      return;
    }

    // A backward jump means RepeatMode.track looped the file → one repeat done.
    if (duration > 0 && this.lastPosition > position + LOOP_WRAP_DROP) {
      this.lastPosition = position;
      void this.onRepeatComplete();
      return;
    }
    this.lastPosition = position;
  }

  // Only fires for changes we didn't initiate — i.e. lock-screen / notification
  // controls. Our own repositioning sets `advancing`. Sync our plan position.
  private onChangeTrack(track: TrackItem): void {
    if (this.advancing) return;
    const index = this.indexOf(track);
    if (Number.isNaN(index) || index === this.stepIndex || !this.plan[index]) return;

    const fromAthkarId = this.plan[this.stepIndex]?.athkarId ?? null;
    this.stepIndex = index;
    this.repeatDone = 0;
    this.lastPosition = 0;
    const step = this.plan[index];
    this.syncUI(step, step.athkarId !== fromAthkarId, null);
  }

  private onPlaybackStateChange(state: TrackPlayerState): void {
    if (!this.playlistId) return;
    // Ignore state churn we caused ourselves (repositioning / smart pause).
    if (this.advancing || this.isSmartPausing) return;

    if (state === "playing") {
      this.setPlayerState(PLAYER_STATE.PLAYING);
    } else if (state === "paused" || state === "stopped") {
      // Never treat a stop as end-of-session — completion is our decision. Reflect
      // it only as a pause so the UI stays truthful when the player halts.
      if (!this.userStopping && this.athkarStore.playerState === PLAYER_STATE.PLAYING) {
        if (state === "stopped") {
          log.w("Player", "Playback stopped unexpectedly mid-session");
        }
        this.setPlayerState(PLAYER_STATE.PAUSED);
      }
    }
  }

  // ─── UI Sync ───────────────────────────────────────────────────────

  private syncUI(step: Step, athkarChanged: boolean, completedAthkarId: string | null): void {
    const thikrNumber = this.uniqueAthkarIds.indexOf(step.athkarId);
    const sessionProgress =
      thikrNumber !== -1
        ? { current: thikrNumber + 1, total: this.uniqueAthkarIds.length }
        : this.athkarStore.sessionProgress;

    if (athkarChanged) {
      const { currentType, morningAthkarList, eveningAthkarList } = this.athkarStore;
      const list = currentType === ATHKAR_TYPE.MORNING ? morningAthkarList : eveningAthkarList;
      const newIndex = list.findIndex((a) => a.id === step.athkarId);
      this.athkarStore.transitionTrack({
        previousAthkarId: completedAthkarId,
        newAthkarId: step.athkarId,
        newThikrId: step.thikrId,
        repeatProgress: { current: this.repeatDone, total: step.repeatTarget },
        sessionProgress,
        newIndex: newIndex !== -1 ? newIndex : this.athkarStore.currentAthkarIndex,
      });
    } else {
      this.athkarStore.setRepeatProgress({ current: this.repeatDone, total: step.repeatTarget });
      this.athkarStore.setCurrentTrack(step.thikrId, step.athkarId);
    }
    this.computeGroupProgress(step.athkarId, step.thikrId);
  }

  // ─── Teardown ──────────────────────────────────────────────────────

  private async completeSession(): Promise<void> {
    log.i("Player", "Session complete");
    await TrackPlayer.pause().catch(() => {});
    await this.teardown();
  }

  private async teardown(): Promise<void> {
    this.clearSmartPauseTimer();
    if (this.playlistId) {
      await PlayerQueue.deletePlaylist(this.playlistId).catch(() => {});
    }
    this.playlistId = null;
    this.plan = [];
    this.uniqueAthkarIds = [];
    this.stepIndex = 0;
    this.repeatDone = 0;
    this.lastPosition = 0;
    this.stepDuration = 0;
    this.isSmartPausing = false;
    this.advancing = false;

    this.athkarStore.resetPlaybackState();
    this.store.setPosition(0);
    this.store.setDuration(0);
    nitroSession.release("athkar");
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private getEffectiveRepeats(totalRepeats: number): number {
    const repeatLimit = this.store.repeatLimit;
    if (repeatLimit === "all") return totalRepeats;
    return Math.min(repeatLimit as number, totalRepeats);
  }

  private getSmartPause(audioDuration: number): number {
    if (audioDuration < SMART_PAUSE.SHORT_THRESHOLD) return SMART_PAUSE.SHORT_PAUSE;
    if (audioDuration < SMART_PAUSE.LONG_THRESHOLD) return SMART_PAUSE.MEDIUM_PAUSE;
    return SMART_PAUSE.LONG_PAUSE;
  }

  private getSessionTitle(): string {
    return i18n.t(`athkar.${this.sessionType}`);
  }

  private getReciterName(): string {
    if (!this.reciterId) return "";
    const catalog = reciterRegistry.getCachedCatalog();
    if (!catalog) return this.reciterId;
    const reciter = catalog.reciters.find((r) => r.id === this.reciterId);
    if (!reciter) return this.reciterId;
    return getLocalizedName(reciter.name, i18n.language) || this.reciterId;
  }

  private clearSmartPauseTimer() {
    if (this.smartPauseTimer) {
      clearTimeout(this.smartPauseTimer);
      this.smartPauseTimer = null;
    }
  }

  // ─── Group Progress ──────────────────────────────────────────────

  private computeGroupProgress(athkarId: string, thikrId: string): void {
    const { currentType, morningAthkarList, eveningAthkarList, currentProgress } = this.athkarStore;
    const list = currentType === ATHKAR_TYPE.MORNING ? morningAthkarList : eveningAthkarList;
    const athkar = list.find((a) => a.id === athkarId);

    if (!athkar?.group) {
      this.athkarStore.setGroupProgress(null);
      return;
    }

    const { group } = athkar;
    const progressItem = currentProgress.find((p) => p.athkarId === athkarId);
    const currentCount = progressItem?.currentCount ?? 0;
    const totalCount = progressItem?.totalCount ?? athkar.count;

    const groupIndex = group.audioIds.indexOf(thikrId);
    const round = Math.floor(currentCount / group.itemsPerRound) + 1;
    const totalRounds = Math.ceil(totalCount / group.itemsPerRound);

    this.athkarStore.setGroupProgress({
      groupIndex: groupIndex !== -1 ? groupIndex : 0,
      itemsPerRound: group.itemsPerRound,
      round,
      totalRounds,
      count: currentCount,
      totalCount,
    });
  }

  // ─── Getters ───────────────────────────────────────────────────────

  isActive(): boolean {
    const state = this.athkarStore.playerState;
    return state !== PLAYER_STATE.IDLE && state !== PLAYER_STATE.ENDED;
  }

  getCurrentAthkarId(): string | null {
    return this.athkarStore.currentAthkarId;
  }
}

export const athkarPlayer = AthkarPlayer.getInstance();
