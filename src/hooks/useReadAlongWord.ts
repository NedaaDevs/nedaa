import { useEffect, useRef, useState } from "react";

import { useQuranStore } from "@/stores/quran";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { QURAN_GRANULARITY, QURAN_PLAYER_STATE } from "@/types/quran-audio";
import type { QuranRecitation } from "@/types/quran-audio";
import type { GlyphBound } from "@/types/quran";
import { quranReciterRegistry } from "@/services/quran-audio/quranReciterRegistry";
import { quranAudioTimings } from "@/services/quran-audio/quranAudioTimings";
import { QuranContentDB } from "@/services/quran-content-db";

// How often to re-map playback position to a word. Coarse enough to be cheap,
// fine enough that the highlight lands within ~a frame of the spoken word.
const TICK_MS = 120;

// Drives the per-word read-along highlight. Loads the reader recitation's word
// timings + the current ayah's word glyphs, then on a light interval maps the
// interpolated playback position to a word and publishes it to the reader store
// (`readAlongWord`). No-op unless read-along is on and an ayah-granular recitation
// is playing; when timings are missing it simply publishes nothing and the reader
// falls back to tinting the whole ayah. Mount once in the reader.
export const useReadAlongWord = () => {
  const readAlong = useQuranStore((s) => s.readAlong);
  const version = useQuranStore((s) => s.currentVersion);
  const setReadAlongWord = useQuranStore((s) => s.setReadAlongWord);

  const selectedRecitationId = useQuranAudioStore((s) => s.selectedRecitationId);
  const currentSurah = useQuranAudioStore((s) => s.currentSurah);
  const currentAyah = useQuranAudioStore((s) => s.currentAyah);
  const playerState = useQuranAudioStore((s) => s.playerState);

  const [recitation, setRecitation] = useState<QuranRecitation | null>(null);
  const wordsRef = useRef<GlyphBound[]>([]);
  const lastWordRef = useRef(-1);

  // Resolve the reader (ayah-granular) recitation and warm its word timings.
  // (A stale recitation while read-along is off is harmless — the tick effect
  // below guards on `readAlong` — so no synchronous reset here.)
  useEffect(() => {
    if (!readAlong) return;
    let alive = true;
    quranReciterRegistry.getRecitationById(selectedRecitationId).then((rec) => {
      if (!alive) return;
      const eligible = rec && rec.granularity === QURAN_GRANULARITY.AYAH ? rec : null;
      setRecitation(eligible);
      if (eligible) void quranAudioTimings.load(eligible);
    });
    return () => {
      alive = false;
    };
  }, [readAlong, selectedRecitationId]);

  // Load the current ayah's word glyphs in global reading order on ayah change.
  useEffect(() => {
    wordsRef.current = [];
    lastWordRef.current = -1;
    if (!readAlong || currentSurah == null || currentAyah == null) return;
    let alive = true;
    QuranContentDB.getAyahWordGlyphs(version, currentSurah, currentAyah).then((ws) => {
      if (alive) wordsRef.current = ws;
    });
    return () => {
      alive = false;
    };
  }, [readAlong, version, currentSurah, currentAyah]);

  // Interpolate position → word index → glyph → store. Ticks only while PLAYING;
  // paused/loading resolves once and holds. Position from the previous ayah is
  // stale until the next progress tick, so the new ayah is treated as at 0 until
  // `positionUpdatedAt` catches up — otherwise the highlight would jump to the
  // last word of the new ayah at every boundary.
  useEffect(() => {
    if (!readAlong || !recitation || currentSurah == null || currentAyah == null) {
      setReadAlongWord(null);
      lastWordRef.current = -1;
      return;
    }
    setReadAlongWord(null); // clear any stale word until this ayah resolves
    lastWordRef.current = -1;
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

      const wordIndex = quranAudioTimings.wordAt(recitation.id, currentSurah, currentAyah, pos);
      if (wordIndex == null) return; // no timings yet → leave ayah fallback
      // Assumes QUL's 1-based word index maps 1:1 onto the ayah's Nth non-marker
      // glyph. If a recitation's word count diverges from the mushaf's, the index
      // can fall out of range — we hold the previous word rather than mis-highlight.
      const glyph = wordsRef.current[wordIndex - 1];
      if (!glyph) return; // out of range / glyphs not loaded yet → keep previous word
      if (wordIndex === lastWordRef.current) return;
      lastWordRef.current = wordIndex;
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
  }, [readAlong, recitation, currentSurah, currentAyah, playerState, setReadAlongWord]);
};
