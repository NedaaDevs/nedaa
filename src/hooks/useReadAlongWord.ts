import { useEffect, useRef, useState } from "react";

import { useQuranStore } from "@/stores/quran";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { QURAN_GRANULARITY, QURAN_PLAYER_STATE } from "@/types/quran-audio";
import type { QuranRecitation } from "@/types/quran-audio";
import type { GlyphBound } from "@/types/quran";
import { ReadAlongGranularity } from "@/enums/quran";
import { quranReciterRegistry } from "@/services/quran-audio/quranReciterRegistry";
import { quranAudioTimings } from "@/services/quran-audio/quranAudioTimings";
import { QuranContentDB } from "@/services/quran-content-db";
import { AppLogger } from "@/utils/appLogger";

// How often to re-map playback position to a word. Coarse enough to be cheap,
// fine enough that the highlight lands within ~a frame of the spoken word.
const TICK_MS = 120;

// Diagnoses why an ayah highlights per-word vs falls back to the whole-verse tint.
// Logged once per recitation-resolve and once per ayah (not per tick) to stay quiet.
const log = AppLogger.create("quran-readalong");

// Drives the per-word read-along highlight. Loads the reader recitation's word
// timings + the current ayah's word glyphs, then on a light interval maps the
// interpolated playback position to a word and publishes it to the reader store
// (`readAlongWord`). No-op unless read-along is on and an ayah-granular recitation
// is playing; when timings are missing it simply publishes nothing and the reader
// falls back to tinting the whole ayah. Mount once in the reader.
export const useReadAlongWord = () => {
  const readAlong = useQuranStore((s) => s.readAlong);
  const granularity = useQuranStore((s) => s.readAlongGranularity);
  const version = useQuranStore((s) => s.currentVersion);
  const setReadAlongWord = useQuranStore((s) => s.setReadAlongWord);

  const readerRecitationId = useQuranAudioStore((s) => s.readerRecitationId);
  const currentSurah = useQuranAudioStore((s) => s.currentSurah);
  const currentAyah = useQuranAudioStore((s) => s.currentAyah);
  const playerState = useQuranAudioStore((s) => s.playerState);

  // Word-level highlighting runs only when read-along is on AND the user chose
  // word granularity; in verse mode this hook stays idle and the reader shows the
  // whole-ayah tint.
  const wordMode = readAlong && granularity === ReadAlongGranularity.WORD;

  // Surface the gate inputs so a device run shows why word mode is (in)active.
  useEffect(() => {
    log.i("Mode", `readAlong=${readAlong} granularity=${granularity} → wordMode=${wordMode}`);
  }, [readAlong, granularity, wordMode]);

  const [recitation, setRecitation] = useState<QuranRecitation | null>(null);
  const wordsRef = useRef<GlyphBound[]>([]);
  const lastWordRef = useRef(-1);
  // Fallback reasons already logged for the current ayah, so each distinct reason
  // logs once (not per 120ms tick).
  const loggedRef = useRef<Set<string>>(new Set());

  // Resolve the reader (ayah-granular) recitation and warm its word timings.
  // (A stale recitation while word mode is off is harmless — the tick effect
  // below guards on `wordMode` — so no synchronous reset here.)
  useEffect(() => {
    if (!wordMode) return;
    let alive = true;
    quranReciterRegistry.getRecitationById(readerRecitationId).then((rec) => {
      if (!alive) return;
      const eligible = rec && rec.granularity === QURAN_GRANULARITY.AYAH ? rec : null;
      log.i(
        "Recitation",
        `reader=${readerRecitationId} gran=${rec?.granularity ?? "missing"} eligible=${!!eligible} timings=${!!eligible?.timings}`
      );
      setRecitation(eligible);
      if (eligible) void quranAudioTimings.load(eligible);
    });
    return () => {
      alive = false;
    };
  }, [wordMode, readerRecitationId]);

  // Load the current ayah's word glyphs in global reading order on ayah change.
  useEffect(() => {
    wordsRef.current = [];
    lastWordRef.current = -1;
    if (!wordMode || currentSurah == null || currentAyah == null) return;
    let alive = true;
    QuranContentDB.getAyahWordGlyphs(version, currentSurah, currentAyah).then((ws) => {
      if (alive) wordsRef.current = ws;
    });
    return () => {
      alive = false;
    };
  }, [wordMode, version, currentSurah, currentAyah]);

  // Interpolate position → word index → glyph → store. Ticks only while PLAYING;
  // paused/loading resolves once and holds. Position from the previous ayah is
  // stale until the next progress tick, so the new ayah is treated as at 0 until
  // `positionUpdatedAt` catches up — otherwise the highlight would jump to the
  // last word of the new ayah at every boundary.
  useEffect(() => {
    if (!wordMode || !recitation || currentSurah == null || currentAyah == null) {
      setReadAlongWord(null);
      lastWordRef.current = -1;
      return;
    }
    setReadAlongWord(null); // clear any stale word until this ayah resolves
    lastWordRef.current = -1;
    loggedRef.current.clear();
    const ayahStartedAt = Date.now();

    const resolve = () => {
      const s = useQuranAudioStore.getState();
      let pos =
        s.positionUpdatedAt >= ayahStartedAt
          ? s.position +
            (s.playerState === QURAN_PLAYER_STATE.PLAYING ? Date.now() - s.positionUpdatedAt : 0)
          : 0;
      pos = Math.max(0, pos);
      if (s.duration > 0) pos = Math.min(pos, s.duration);

      // Each fallback reason logs once per ayah (not per tick), so a device run
      // shows exactly why an ayah isn't tracking per-word.
      const a = `${currentSurah}:${currentAyah}`;
      const logOnce = (reason: string, msg: string) => {
        if (loggedRef.current.has(reason)) return;
        loggedRef.current.add(reason);
        log.i("Word", msg);
      };

      // Per-word highlighting is only safe when the timings' word count matches the
      // mushaf's glyph words. Any mismatch/missing data holds the whole-ayah tint.
      const glyphCount = wordsRef.current.length;
      if (glyphCount === 0) {
        logOnce("no-glyphs", `${a} verse — glyphs not loaded yet`);
        return;
      }
      const timingCount = quranAudioTimings.ayahWordCount(recitation.id, currentSurah, currentAyah);
      if (timingCount === 0) {
        logOnce("no-timings", `${a} verse — no timings for this ayah`);
        return;
      }
      if (timingCount !== glyphCount) {
        logOnce("diverge", `${a} verse — diverge glyph=${glyphCount} timing=${timingCount}`);
        return;
      }

      const wordIndex = quranAudioTimings.wordAt(recitation.id, currentSurah, currentAyah, pos);
      if (wordIndex == null) {
        logOnce("before-first", `${a} verse — pos ${Math.round(pos)}ms before first word`);
        return;
      }
      // QUL's 1-based word index should map onto the ayah's Nth non-marker glyph;
      // an index past the glyph count (gappy timing data) holds the previous word.
      const glyph = wordsRef.current[wordIndex - 1];
      if (!glyph) {
        logOnce("oob", `${a} verse — word ${wordIndex} OUT OF RANGE (glyphs ${glyphCount})`);
        return;
      }
      if (wordIndex === lastWordRef.current) return;
      lastWordRef.current = wordIndex;
      // Logs on every word advance (not per tick) so a device run shows the
      // word-by-word tracking: which word, playback position, page/line.
      log.i(
        "Word",
        `${currentSurah}:${currentAyah} w${wordIndex}/${glyphCount} @${Math.round(pos)}ms p${glyph.page} l${glyph.line}`
      );
      setReadAlongWord({
        surah: currentSurah,
        ayah: currentAyah,
        page: glyph.page,
        line: glyph.line,
        x: glyph.x,
        y: glyph.y,
        width: glyph.width,
        height: glyph.height,
      });
    };

    resolve();
    if (playerState !== QURAN_PLAYER_STATE.PLAYING) return; // idle while paused/loading
    const id = setInterval(resolve, TICK_MS);
    return () => clearInterval(id);
  }, [wordMode, recitation, currentSurah, currentAyah, playerState, setReadAlongWord]);
};
