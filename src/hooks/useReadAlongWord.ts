import { useEffect, useRef, useState } from "react";

import { useQuranStore } from "@/stores/quran";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { QURAN_GRANULARITY, QURAN_PLAYER_STATE, QURAN_QUEUE_KIND } from "@/types/quran-audio";
import type { QuranRecitation } from "@/types/quran-audio";
import type { GlyphBound } from "@/types/quran";
import { ReadAlongGranularity } from "@/enums/quran";
import { quranReciterRegistry } from "@/services/quran-audio/quranReciterRegistry";
import { quranAudioTimings } from "@/services/quran-audio/quranAudioTimings";
import { QuranContentDB } from "@/services/quran-content-db";
import { AppLogger } from "@/utils/appLogger";

// The driver wakes exactly at the next word boundary (scheduled from the timing
// segments) instead of polling, so words light on time rather than up to a poll
// interval late. This coarse tick is only the fallback while there is no known
// upcoming boundary (data still loading, gaps, the tail hold).
const FALLBACK_TICK_MS = 250;

// Wake-up clamps: MIN guards against zero/negative delays (schedule immediately
// but yield a frame); MAX keeps long gaps re-checked against live state.
const MIN_WAKE_MS = 16;
const MAX_WAKE_MS = 1000;
// Fire just past the boundary so the position lands inside the new word's window.
const BOUNDARY_SLACK_MS = 8;

// Constant lead compensating event/bridge/render latency — a highlight that
// slightly leads the audio reads as simultaneous; one that trails reads as laggy.
const HIGHLIGHT_LEAD_MS = 110;

// The aligner assigns each file's leading silence to word 1's window (its start is
// ~0ms), so word 1 would light before the reciter speaks. Until playback passes
// this mark, the previous ayah's held word stays lit instead.
const FIRST_WORD_LEAD_IN_MS = 450;

// A word-index drop with playback this close to the track start is a repeat-mode
// replay; any later drop is interpolation jitter and holds instead.
const REPLAY_WINDOW_MS = 2000;

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
  const setReadAlongVerse = useQuranStore((s) => s.setReadAlongVerse);

  const readerRecitationId = useQuranAudioStore((s) => s.readerRecitationId);
  const currentSurah = useQuranAudioStore((s) => s.currentSurah);
  const currentAyah = useQuranAudioStore((s) => s.currentAyah);
  const playerState = useQuranAudioStore((s) => s.playerState);
  const queueKind = useQuranAudioStore((s) => s.queue?.kind);

  // Word-level highlighting runs only when read-along is on AND the user chose
  // word granularity; in verse mode this hook stays idle and the reader shows the
  // whole-ayah tint.
  const wordMode = readAlong && granularity === ReadAlongGranularity.WORD;

  // Surface the gate inputs so a device run shows why word mode is (in)active.
  useEffect(() => {
    log.i("Mode", `readAlong=${readAlong} granularity=${granularity} → wordMode=${wordMode}`);
  }, [readAlong, granularity, wordMode]);

  const [recitation, setRecitation] = useState<QuranRecitation | null>(null);
  // The current ayah's glyphs keyed by canonical QPC word index, plus the highest
  // index — timing indices past it are trailing surplus (= the ayah has ended).
  const wordsRef = useRef<Map<number, GlyphBound>>(new Map());
  const maxWordRef = useRef(0);
  const lastWordRef = useRef(-1);
  // Mirrors the published `readAlongVerse` so we only write it on change (not per tick).
  const verseRef = useRef(false);
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

  // Load the current ayah's word glyphs on ayah change, keyed by their canonical
  // QPC word index (timing indices map onto it directly).
  useEffect(() => {
    wordsRef.current = new Map();
    maxWordRef.current = 0;
    lastWordRef.current = -1;
    if (!wordMode || currentSurah == null || currentAyah == null) return;
    let alive = true;
    QuranContentDB.getAyahWordGlyphs(version, currentSurah, currentAyah).then((ws) => {
      if (!alive) return;
      const map = new Map<number, GlyphBound>();
      let max = 0;
      for (const g of ws) {
        map.set(g.wordIndex, g);
        if (g.wordIndex > max) max = g.wordIndex;
      }
      wordsRef.current = map;
      maxWordRef.current = max;
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
    if (
      !wordMode ||
      !recitation ||
      currentSurah == null ||
      currentAyah == null ||
      queueKind === QURAN_QUEUE_KIND.SURAH // a Listen (gapless) session — not the reader's
    ) {
      setReadAlongWord(null);
      lastWordRef.current = -1;
      return;
    }
    // The previous ayah's last word stays lit through the track change — the gap
    // between ayahs is the reciter's breath, and a dark flash there reads as a
    // glitch. It swaps to the new ayah's word 1 once recitation resumes.
    setReadAlongVerse(false);
    lastWordRef.current = -1;
    verseRef.current = false;
    loggedRef.current.clear();
    const ayahStartedAt = Date.now();

    const resolve = (): number => {
      const s = useQuranAudioStore.getState();
      // Publish the whole-ayah fallback flag only on change (avoids per-tick sets).
      const setVerse = (on: boolean) => {
        if (verseRef.current === on) return;
        verseRef.current = on;
        setReadAlongVerse(on);
      };
      // Store position/duration are in SECONDS (matching the scrubber); word
      // timings are in MILLISECONDS — so convert to ms here before comparing.
      let pos =
        s.positionUpdatedAt >= ayahStartedAt
          ? s.position * 1000 +
            (s.playerState === QURAN_PLAYER_STATE.PLAYING ? Date.now() - s.positionUpdatedAt : 0)
          : 0;
      pos = Math.max(0, pos);
      if (s.duration > 0) pos = Math.min(pos, s.duration * 1000);
      pos += HIGHLIGHT_LEAD_MS;

      // Each fallback reason logs once per ayah (not per tick), so a device run
      // shows exactly why an ayah isn't tracking per-word.
      const a = `${currentSurah}:${currentAyah}`;
      const logOnce = (reason: string, msg: string) => {
        if (loggedRef.current.has(reason)) return;
        loggedRef.current.add(reason);
        log.i("Word", msg);
      };

      // Timing word indices and glyph wordIndex share the QPC enumeration (identity
      // for words 1..N, verified across all 6236 ayahs) — no count reconciliation.
      if (wordsRef.current.size === 0) {
        // Glyphs still loading — show nothing (no flash), not the verse fallback.
        logOnce("no-glyphs", `${a} waiting — glyphs not loaded yet`);
        return pos;
      }
      const timingCount = quranAudioTimings.ayahWordCount(recitation.id, currentSurah, currentAyah);
      if (timingCount === 0) {
        // No word entry → whole-ayah fallback once timings are loaded; until then
        // it's still loading, so show nothing.
        const loaded = quranAudioTimings.isLoaded(recitation.id);
        setVerse(loaded);
        // Release the previous ayah's held word — word rects outrank the verse
        // tint, so a lingering hold would mask this ayah's fallback entirely.
        if (loaded && !loggedRef.current.has("released-held")) {
          loggedRef.current.add("released-held");
          setReadAlongWord(null);
        }
        logOnce(
          "no-timings",
          `${a} ${loaded ? "verse — no timings" : "waiting — timings loading"}`
        );
        return pos;
      }

      const wordIndex = quranAudioTimings.wordAt(recitation.id, currentSurah, currentAyah, pos);
      if (wordIndex == null) {
        // Audio hasn't reached word 1 yet — hold whatever is lit (the previous
        // ayah's last word), not a dark flash.
        logOnce("before-first", `${a} waiting — pos ${Math.round(pos)}ms before first word`);
        return pos;
      }
      // Word 1's window starts at ~0ms (leading silence included), so hold the
      // previous ayah's word through the breath until recitation plausibly resumed.
      if (wordIndex === 1 && lastWordRef.current === -1 && pos < FIRST_WORD_LEAD_IN_MS) {
        return pos;
      }
      // A backward word jump near the track start is a replay (repeat mode looped
      // this ayah) — restart tracking. Elsewhere it's interpolation jitter around a
      // progress correction — hold the current word rather than jumping back.
      if (wordIndex < lastWordRef.current) {
        if (pos < REPLAY_WINDOW_MS) {
          lastWordRef.current = -1;
          loggedRef.current.clear();
          logOnce("replay", `${a} looped — restarting word tracking`);
        } else {
          return pos;
        }
      }
      // Some timing files carry trailing surplus segments past the last QPC word
      // (the pause/end-marker tail). The words are done — hold the last word lit
      // until the next ayah takes over (a dark gap here reads as a glitch).
      if (wordIndex > maxWordRef.current) {
        logOnce("tail", `${a} tail segment w${wordIndex} > ${maxWordRef.current} — holding last`);
        return pos;
      }
      const glyph = wordsRef.current.get(wordIndex);
      if (!glyph) {
        logOnce("oob", `${a} word ${wordIndex} has no glyph — holding`);
        return pos;
      }
      if (wordIndex === lastWordRef.current) return pos;
      setVerse(false); // tracking a word → not the whole-ayah fallback
      lastWordRef.current = wordIndex;
      // Logs on every word advance (not per tick) so a device run shows the
      // word-by-word tracking: which word, playback position, page/line.
      log.d(
        "Word",
        `${currentSurah}:${currentAyah} w${wordIndex}/${maxWordRef.current} @${Math.round(pos)}ms p${glyph.page} l${glyph.line}`
      );
      setReadAlongWord({
        surah: currentSurah,
        ayah: currentAyah,
        wordIndex,
        page: glyph.page,
        line: glyph.line,
        x: glyph.x,
        y: glyph.y,
        width: glyph.width,
        height: glyph.height,
      });
      return pos;
    };

    resolve();
    if (playerState !== QURAN_PLAYER_STATE.PLAYING) return; // idle while paused/loading

    // Wake exactly at the next word boundary; fall back to a coarse tick while no
    // boundary is known. Each player progress event re-anchors the schedule, so a
    // position correction moves the next wake-up instead of waiting out a stale one.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loop = () => {
      const pos = resolve();
      const next = quranAudioTimings.nextWordStartAfter(
        recitation.id,
        currentSurah,
        currentAyah,
        pos
      );
      const delay =
        next != null
          ? Math.min(Math.max(next - pos + BOUNDARY_SLACK_MS, MIN_WAKE_MS), MAX_WAKE_MS)
          : FALLBACK_TICK_MS;
      timer = setTimeout(loop, delay);
    };
    loop();
    const unsubscribe = useQuranAudioStore.subscribe((now, prev) => {
      if (now.positionUpdatedAt !== prev.positionUpdatedAt) {
        if (timer) clearTimeout(timer);
        loop();
      }
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [
    wordMode,
    recitation,
    currentSurah,
    currentAyah,
    playerState,
    queueKind,
    setReadAlongWord,
    setReadAlongVerse,
  ]);
};
