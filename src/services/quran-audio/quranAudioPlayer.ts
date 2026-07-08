import { TrackPlayer, PlayerQueue } from "react-native-nitro-player";
import type { TrackItem, TrackPlayerState, Reason, RepeatMode } from "react-native-nitro-player";

import { nitroSession, NITRO_STATE, NITRO_REASON } from "@/services/audio/nitroSession";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { quranReciterRegistry } from "@/services/quran-audio/quranReciterRegistry";
import { quranAudioDownload } from "@/services/quran-audio/quranAudioDownload";
import { QuranManifestService } from "@/services/quran-manifest";
import { QuranContentDB } from "@/services/quran-content-db";
import {
  remoteAyahUrl,
  remoteSurahUrl,
  buildAyahRange,
} from "@/services/quran-audio/quranAudioUrl";
import {
  QURAN_PLAYER_STATE,
  QURAN_LISTEN_MODE,
  type QuranQueueItem,
  type QuranQueueKind,
  type QuranListenMode,
} from "@/types/quran-audio";
import { localizedSurahName } from "@/utils/surahName";
import { AppLogger } from "@/utils/appLogger";
import i18n from "@/localization/i18n";

const log = AppLogger.create("quran-audio");

const SURAH_COUNT = 114;

// Two playback shapes share one nitro player:
//  - Listen (gapless): one playlist of all 114 surah files, so the OS lock-screen
//    next/previous move between surahs natively and upcoming surahs prebuffer.
//    Rebuilt only when the reciter changes; switching surah is a native skip.
//  - Reader (per-ayah): a single-surah queue of ayah files.
// Each track change records which surah/ayah is now sounding as currentAyah.
class QuranAudioPlayer {
  private static instance: QuranAudioPlayer;
  private initialized = false;
  private playlistId: string | null = null;
  private items: QuranQueueItem[] = [];
  private userStopping = false;
  // Bumped on every play*(); a build only commits if it's still the latest.
  private buildToken = 0;
  // The full-surah playlist is memoized per reciter; null once torn down or when
  // an ayah queue is loaded instead.
  private surahPlaylistReciter: string | null = null;
  private isSurahPlaylist = false;
  // Sleep timer: a pending duration timeout, and/or a one-shot "stop at the end
  // of the current surah" flag.
  private sleepTimerId: ReturnType<typeof setTimeout> | null = null;
  private stopAtSurahEnd = false;

  static getInstance(): QuranAudioPlayer {
    if (!QuranAudioPlayer.instance) QuranAudioPlayer.instance = new QuranAudioPlayer();
    return QuranAudioPlayer.instance;
  }

  private get store() {
    return useQuranAudioStore.getState();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    nitroSession.register("quran", {
      onChangeTrack: (track, reason) => this.onChangeTrack(track, reason),
      onPlaybackStateChange: (state, reason) => this.onPlaybackStateChange(state, reason),
      onEvict: () => this.teardown(),
    });
    await nitroSession.ensureStarted();
    this.initialized = true;
  }

  // Track ids are `t<index>`, assigned in queue order at build time.
  private indexOf(track: TrackItem): number {
    return Number(track.id.slice(1));
  }

  private async resolveRecitation() {
    const id = this.store.selectedRecitationId;
    return (
      (await quranReciterRegistry.getRecitationById(id)) ??
      (await quranReciterRegistry.getDefaultRecitation())
    );
  }

  // Repeat mode is a live projection of the listen mode. REPEAT_SURAH loops the
  // current surah — one track in the surah playlist ("track"), the whole ayah
  // queue in the reader ("Playlist"). An armed surah-end sleep timer suppresses
  // repeat so the surah actually ends. Every other mode plays through.
  private async applyRepeatMode(): Promise<void> {
    let repeat: RepeatMode = "off";
    if (!this.stopAtSurahEnd && this.store.listenMode === QURAN_LISTEN_MODE.REPEAT_SURAH) {
      repeat = this.isSurahPlaylist ? "track" : "Playlist";
    }
    await TrackPlayer.setRepeatMode(repeat);
  }

  // Change the listen mode and, if a queue is loaded, re-apply it to the running
  // player so switching the mode mid-playback takes effect immediately.
  async setListenMode(mode: QuranListenMode): Promise<void> {
    this.store.setListenMode(mode);
    if (this.playlistId) await this.applyRepeatMode();
  }

  private clearSleepTimer(): void {
    if (this.sleepTimerId) clearTimeout(this.sleepTimerId);
    this.sleepTimerId = null;
    this.stopAtSurahEnd = false;
  }

  // Clear any sleep timer and restore the listen mode's repeat behavior.
  async setSleepOff(): Promise<void> {
    this.clearSleepTimer();
    this.store.setSleepTimer(null, null, false);
    if (this.playlistId) await this.applyRepeatMode();
  }

  // Stop when the current surah finishes (overriding advance/repeat this once).
  async setSleepAtSurahEnd(): Promise<void> {
    this.clearSleepTimer();
    this.stopAtSurahEnd = true;
    this.store.setSleepTimer(null, null, true);
    if (this.playlistId) await this.applyRepeatMode();
  }

  // Stop after `minutes`, regardless of what is playing at that moment.
  async setSleepAfter(minutes: number): Promise<void> {
    this.clearSleepTimer();
    this.sleepTimerId = setTimeout(() => void this.stop(), minutes * 60_000);
    this.store.setSleepTimer(Date.now() + minutes * 60_000, minutes, false);
    if (this.playlistId) await this.applyRepeatMode();
  }

  // Best-effort warm-up for the Listen surface: pre-fetches the manifest (so a
  // later play* skips the API round trip) and issues a tiny ranged GET for the
  // first surah, which warms the connection (reused for every surah) and caches
  // that first file. A HEAD would only warm the connection, not the cache.
  // Failures are ignored — playback does its own fetching regardless.
  async warmUp(): Promise<void> {
    try {
      const recitation = await this.resolveRecitation();
      const manifest = await QuranManifestService.fetchManifest();
      if (!recitation || !manifest) return;
      await fetch(remoteSurahUrl(manifest.baseUrl, recitation, 1), {
        headers: { Range: "bytes=0-1" },
      });
    } catch {
      // warm-up only; playback fetches for itself
    }
  }

  // Play a surah from the gapless full-surah playlist. Reuses the loaded playlist
  // (a native skip to the surah) unless the reciter changed, so switching surahs
  // and the lock-screen next/previous are instant rather than a rebuild.
  async playSurah(surah: number): Promise<void> {
    const token = ++this.buildToken;
    // Reflect the target immediately so the mini-player shows a loading spinner
    // the instant the surah is tapped, before init/handoff and the network fetch.
    this.store.setCurrentAyah(surah, 1);
    this.store.setPlayerState(QURAN_PLAYER_STATE.LOADING);

    try {
      await this.initialize();
      await nitroSession.acquire("quran");

      const recitation = await this.resolveRecitation();
      const manifest = await QuranManifestService.fetchManifest();
      if (!recitation || !manifest) {
        log.w("Player", "no recitation or manifest");
        await this.teardown();
        return;
      }

      const reuse =
        this.isSurahPlaylist &&
        this.playlistId !== null &&
        this.surahPlaylistReciter === recitation.id;

      if (!reuse) {
        const reciter = await quranReciterRegistry.reciterOf(recitation.id);
        const artist = reciter ? quranReciterRegistry.localizedName(reciter, i18n.language) : "";
        const items: QuranQueueItem[] = [];
        const tracks: TrackItem[] = [];
        for (let n = 1; n <= SURAH_COUNT; n++) {
          const url = remoteSurahUrl(manifest.baseUrl, recitation, n);
          items.push({ surah: n, ayah: 1, url });
          tracks.push({
            id: `t${n - 1}`,
            title: localizedSurahName(n),
            artist,
            album: "",
            duration: 0,
            url,
            artwork: undefined,
          });
        }

        // A newer play superseded us while resolving; it owns the player now.
        if (token !== this.buildToken) return;

        if (this.playlistId) await PlayerQueue.deletePlaylist(this.playlistId).catch(() => {});
        const pid = await PlayerQueue.createPlaylist("quran-surahs");
        await PlayerQueue.addTracksToPlaylist(pid, tracks);
        if (token !== this.buildToken) {
          await PlayerQueue.deletePlaylist(pid).catch(() => {});
          return;
        }
        this.items = items;
        this.playlistId = pid;
        this.surahPlaylistReciter = recitation.id;
        this.isSurahPlaylist = true;
        await PlayerQueue.loadPlaylist(pid, surah - 1);
      } else {
        if (token !== this.buildToken) return;
        await TrackPlayer.skipToIndex(surah - 1);
      }

      if (token !== this.buildToken) return;
      this.store.setQueue({ kind: "surah", surah, fromAyah: 1, toAyah: 1 });
      this.store.setCurrentAyah(surah, 1);
      await this.applyRepeatMode();
      await TrackPlayer.play();
    } catch (error) {
      log.e("Player", "playSurah failed", error as Error);
      if (token === this.buildToken) await this.teardown();
    }
  }

  // Build a per-ayah queue [fromAyah..toAyah] within one surah (reader path),
  // preferring downloaded files.
  private async playAyahRange(
    kind: QuranQueueKind,
    surah: number,
    fromAyah: number,
    toAyah: number
  ): Promise<void> {
    const token = ++this.buildToken;
    this.store.setCurrentAyah(surah, fromAyah);
    this.store.setPlayerState(QURAN_PLAYER_STATE.LOADING);

    try {
      await this.initialize();
      await nitroSession.acquire("quran");

      const recitation = await this.resolveRecitation();
      const manifest = await QuranManifestService.fetchManifest();
      if (!recitation || !manifest) {
        log.w("Player", "no recitation or manifest");
        await this.teardown();
        return;
      }

      let items: QuranQueueItem[];
      if (recitation.granularity === "surah") {
        items = [{ surah, ayah: 1, url: remoteSurahUrl(manifest.baseUrl, recitation, surah) }];
      } else {
        items = buildAyahRange(surah, fromAyah, toAyah, (s, a) =>
          remoteAyahUrl(manifest.baseUrl, recitation, s, a)
        );
        for (const item of items) {
          const local = await quranAudioDownload.getLocalPath(
            recitation.id,
            item.surah,
            item.ayah,
            recitation.fileFormat
          );
          if (local) item.url = local;
        }
      }

      const surahMeta = await QuranContentDB.getSurah(surah);
      const title = surahMeta?.nameArabic ?? `${surah}`;
      const reciter = await quranReciterRegistry.reciterOf(recitation.id);
      const artist = reciter ? quranReciterRegistry.localizedName(reciter, i18n.language) : "";
      const tracks: TrackItem[] = items.map((item, i) => ({
        id: `t${i}`,
        title,
        artist,
        album: "",
        duration: 0,
        url: item.url,
        artwork: undefined,
      }));

      if (token !== this.buildToken) return;

      if (this.playlistId) await PlayerQueue.deletePlaylist(this.playlistId).catch(() => {});
      const pid = await PlayerQueue.createPlaylist(`quran-${surah}-${fromAyah}`);
      await PlayerQueue.addTracksToPlaylist(pid, tracks);
      await PlayerQueue.loadPlaylist(pid);

      if (token !== this.buildToken) {
        await PlayerQueue.deletePlaylist(pid).catch(() => {});
        return;
      }

      this.items = items;
      this.playlistId = pid;
      this.surahPlaylistReciter = null;
      this.isSurahPlaylist = false;
      this.store.setQueue({ kind, surah, fromAyah, toAyah });
      this.store.setCurrentAyah(surah, fromAyah);
      await this.applyRepeatMode();
      await TrackPlayer.playSong("t0", pid);
      await TrackPlayer.play();
    } catch (error) {
      log.e("Player", "playAyahRange failed", error as Error);
      if (token === this.buildToken) await this.teardown();
    }
  }

  async playAyah(surah: number, ayah: number): Promise<void> {
    await this.playAyahRange("ayah", surah, ayah, ayah);
  }

  async playFromHere(surah: number, ayah: number): Promise<void> {
    const last = (await QuranContentDB.getSurah(surah))?.ayahCount ?? ayah;
    await this.playAyahRange("from-here", surah, ayah, last);
  }

  async pause(): Promise<void> {
    await TrackPlayer.pause();
  }

  async resume(): Promise<void> {
    if (!this.playlistId) return;
    await TrackPlayer.play();
  }

  async stop(): Promise<void> {
    this.userStopping = true;
    try {
      await TrackPlayer.pause();
      await this.teardown();
    } finally {
      this.userStopping = false;
    }
  }

  isActive(): boolean {
    return this.store.playerState !== QURAN_PLAYER_STATE.IDLE;
  }

  private onChangeTrack(track: TrackItem, reason?: Reason): void {
    if (!this.playlistId) return;
    const item = this.items[this.indexOf(track)];
    if (!item) return;
    this.store.setCurrentAyah(item.surah, item.ayah);

    // A surah that finishes on its own auto-advances to the next track in the full
    // playlist (reason "end"). End the session there when STOP mode or a surah-end
    // sleep timer asks for it; a user-initiated skip (lock screen / mini-player)
    // carries a different reason and still moves freely.
    if (
      this.isSurahPlaylist &&
      reason === NITRO_REASON.END &&
      (this.stopAtSurahEnd || this.store.listenMode === QURAN_LISTEN_MODE.STOP)
    ) {
      void this.stop();
    }
  }

  private onPlaybackStateChange(state: TrackPlayerState, reason?: Reason): void {
    if (!this.playlistId) return;
    if (state === NITRO_STATE.PLAYING) {
      this.store.setPlayerState(QURAN_PLAYER_STATE.PLAYING);
    } else if (state === NITRO_STATE.PAUSED) {
      this.store.setPlayerState(QURAN_PLAYER_STATE.PAUSED);
    } else if (state === NITRO_STATE.STOPPED && !this.userStopping) {
      // The queue reached its end (last surah / last ayah). Other stops are an
      // error or interruption — surface them as a pause, not an end.
      if (reason === NITRO_REASON.END) {
        void this.teardown();
      } else {
        log.w("Player", `unexpected stop (${reason ?? "unknown"})`);
        this.store.setPlayerState(QURAN_PLAYER_STATE.PAUSED);
      }
    }
  }

  private async teardown(): Promise<void> {
    this.clearSleepTimer();
    if (this.playlistId) await PlayerQueue.deletePlaylist(this.playlistId).catch(() => {});
    this.playlistId = null;
    this.items = [];
    this.surahPlaylistReciter = null;
    this.isSurahPlaylist = false;
    this.store.resetPlayback();
    nitroSession.release("quran");
  }
}

export const quranAudioPlayer = QuranAudioPlayer.getInstance();
