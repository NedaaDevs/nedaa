import { TrackPlayer, PlayerQueue } from "react-native-nitro-player";
import type { TrackItem, TrackPlayerState, Reason } from "react-native-nitro-player";

import { nitroSession } from "@/services/audio/nitroSession";
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
import { AppLogger } from "@/utils/appLogger";
import i18n from "@/localization/i18n";

const log = AppLogger.create("quran-audio");

// Plays a queue of consecutive ayahs. Nitro owns the queue and advances through
// it; each track change records which ayah is now sounding as the store's
// currentAyah.
class QuranAudioPlayer {
  private static instance: QuranAudioPlayer;
  private initialized = false;
  private playlistId: string | null = null;
  private items: QuranQueueItem[] = [];
  private userStopping = false;
  // Bumped on every play(); a build only commits if it's still the latest.
  private buildToken = 0;

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
      onChangeTrack: (track) => this.onChangeTrack(track),
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

  // Repeat mode is a live projection of the listen mode: REPEAT_SURAH loops the
  // loaded surah, every other mode plays through once and lets handleQueueEnd
  // decide what happens at the end.
  private async applyRepeatMode(): Promise<void> {
    const repeat = this.store.listenMode === QURAN_LISTEN_MODE.REPEAT_SURAH ? "Playlist" : "off";
    await TrackPlayer.setRepeatMode(repeat);
  }

  // Change the listen mode and, if a surah is loaded, re-apply it to the running
  // queue so switching the mode mid-playback takes effect immediately.
  async setListenMode(mode: QuranListenMode): Promise<void> {
    this.store.setListenMode(mode);
    if (this.playlistId) await this.applyRepeatMode();
  }

  // Build the ayah queue [fromAyah..toAyah] for one surah, load it into nitro,
  // and start playback. A build token makes the latest call win: if a newer
  // play() starts while this one is still resolving, the stale build abandons
  // its work instead of racing on the shared player.
  private async play(
    kind: QuranQueueKind,
    surah: number,
    fromAyah: number,
    toAyah: number
  ): Promise<void> {
    const token = ++this.buildToken;
    await this.initialize();
    await nitroSession.acquire("quran");
    this.store.setPlayerState(QURAN_PLAYER_STATE.LOADING);

    try {
      const recitation = await this.resolveRecitation();
      const manifest = await QuranManifestService.fetchManifest();
      if (!recitation || !manifest) {
        log.w("Player", "no recitation or manifest");
        await this.teardown();
        return;
      }

      // Gapless recitations are one file per surah; ayah recitations expand to
      // one file per ayah (preferring downloaded files).
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

      // A newer play() superseded us while resolving; it now owns the player.
      if (token !== this.buildToken) return;

      if (this.playlistId) await PlayerQueue.deletePlaylist(this.playlistId).catch(() => {});
      const pid = await PlayerQueue.createPlaylist(`quran-${surah}-${fromAyah}`);
      await PlayerQueue.addTracksToPlaylist(pid, tracks);
      await PlayerQueue.loadPlaylist(pid);

      // Superseded during the load; drop the orphan playlist we just created.
      if (token !== this.buildToken) {
        await PlayerQueue.deletePlaylist(pid).catch(() => {});
        return;
      }

      this.items = items;
      this.playlistId = pid;
      this.store.setQueue({ kind, surah, fromAyah, toAyah });
      this.store.setCurrentAyah(surah, fromAyah);
      await this.applyRepeatMode();
      await TrackPlayer.playSong("t0", pid);
      await TrackPlayer.play();
    } catch (error) {
      log.e("Player", "play failed", error as Error);
      // Only recover if we're still the active build; a newer one owns state now.
      if (token === this.buildToken) await this.teardown();
    }
  }

  async playAyah(surah: number, ayah: number): Promise<void> {
    await this.play("ayah", surah, ayah, ayah);
  }

  async playFromHere(surah: number, ayah: number): Promise<void> {
    const last = (await QuranContentDB.getSurah(surah))?.ayahCount ?? ayah;
    await this.play("from-here", surah, ayah, last);
  }

  async playSurah(surah: number): Promise<void> {
    const last = (await QuranContentDB.getSurah(surah))?.ayahCount ?? 1;
    await this.play("surah", surah, 1, last);
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

  private onChangeTrack(track: TrackItem): void {
    if (!this.playlistId) return;
    const item = this.items[this.indexOf(track)];
    if (!item) return;
    this.store.setCurrentAyah(item.surah, item.ayah);
  }

  private onPlaybackStateChange(state: TrackPlayerState, reason?: Reason): void {
    if (!this.playlistId) return;
    if (state === "playing") {
      this.store.setPlayerState(QURAN_PLAYER_STATE.PLAYING);
    } else if (state === "paused") {
      this.store.setPlayerState(QURAN_PLAYER_STATE.PAUSED);
    } else if (state === "stopped" && !this.userStopping) {
      // Only a natural queue-end advances or ends the session. An error or
      // interruption ("error"/"user_action"/…) is surfaced as a pause, never
      // mistaken for the surah finishing.
      if (reason === "end") {
        void this.handleQueueEnd();
      } else {
        log.w("Player", `unexpected stop (${reason ?? "unknown"})`);
        this.store.setPlayerState(QURAN_PLAYER_STATE.PAUSED);
      }
    }
  }

  // The loaded surah finished. Continue to the next surah only in ADVANCE listen
  // mode; otherwise stop.
  private async handleQueueEnd(): Promise<void> {
    const q = this.store.queue;
    if (
      q?.kind === "surah" &&
      this.store.listenMode === QURAN_LISTEN_MODE.ADVANCE &&
      q.surah < 114
    ) {
      await this.playSurah(q.surah + 1);
      return;
    }
    await this.teardown();
  }

  private async teardown(): Promise<void> {
    if (this.playlistId) await PlayerQueue.deletePlaylist(this.playlistId).catch(() => {});
    this.playlistId = null;
    this.items = [];
    this.store.resetPlayback();
    nitroSession.release("quran");
  }
}

export const quranAudioPlayer = QuranAudioPlayer.getInstance();
