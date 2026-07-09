import { QuranManifestService } from "@/services/quran-manifest";
import { AppLogger } from "@/utils/appLogger";
import type { QuranRecitation, WordSegment, AyahSegmentMap } from "@/types/quran-audio";

const log = AppLogger.create("quran-timings");

const ayahKey = (surah: number, ayah: number): string => `${surah}:${ayah}`;

// Loaded per-recitation word segments, in memory for the session.
const cache = new Map<string, AyahSegmentMap>();
const inflight = new Map<string, Promise<AyahSegmentMap | null>>();

const isValidSegment = (s: unknown): s is WordSegment =>
  Array.isArray(s) &&
  s.length >= 3 &&
  typeof s[0] === "number" &&
  typeof s[1] === "number" &&
  typeof s[2] === "number";

// Accept the stripped artifact shape (`{"s:a": [[...]]}`) or the raw QUL shape
// (`{"s:a": { segments: [[...]] }}`), keeping only well-formed `[idx, start, end]`
// triples so malformed upstream data can't feed wrong comparisons into wordAt().
const parse = (raw: unknown): AyahSegmentMap => {
  const out: AyahSegmentMap = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const segs = Array.isArray(v) ? v : (v as { segments?: unknown })?.segments;
    if (!Array.isArray(segs)) continue;
    const valid = segs.filter(isValidSegment);
    if (valid.length > 0) out[k] = valid;
  }
  return out;
};

// Fetch + cache a recitation's word-timing map. Null when the recitation ships no
// `timings` artifact or the fetch/parse fails (caller falls back to ayah-level
// highlight). A response that parses to no usable segments is NOT cached, so a bad
// deploy/captive-portal 200 can recover on a later attempt instead of poisoning the
// whole session.
const load = async (recitation: QuranRecitation): Promise<AyahSegmentMap | null> => {
  if (!recitation.timings) return null;
  const cached = cache.get(recitation.id);
  if (cached) return cached;
  const existing = inflight.get(recitation.id);
  if (existing) return existing;

  const p = (async (): Promise<AyahSegmentMap | null> => {
    try {
      const manifest = await QuranManifestService.fetchManifest();
      if (!manifest) return null;
      const url = `${manifest.baseUrl.replace(/\/$/, "")}/${recitation.timings!.url.replace(/^\//, "")}`;
      const res = await fetch(url);
      if (!res.ok) {
        log.w("Timings", `fetch ${res.status} for ${recitation.id}`);
        return null;
      }
      const map = parse(await res.json());
      if (Object.keys(map).length === 0) {
        log.w("Timings", `empty/invalid timings for ${recitation.id} — not caching`);
        return null;
      }
      cache.set(recitation.id, map);
      log.i("Timings", `loaded ${Object.keys(map).length} ayah segments for ${recitation.id}`);
      return map;
    } catch (error) {
      log.w("Timings", `load failed for ${recitation.id}: ${(error as Error)?.message}`);
      return null;
    } finally {
      inflight.delete(recitation.id);
    }
  })();

  inflight.set(recitation.id, p);
  return p;
};

// The 1-based word index recited at `positionMs` within (surah, ayah), or null if
// timings aren't loaded or playback hasn't reached the first word. In a gap between
// words the previous word stays lit. Order-independent (picks the latest word whose
// start has passed) so an out-of-order segment can't truncate the search.
const wordAt = (
  recitationId: string,
  surah: number,
  ayah: number,
  positionMs: number
): number | null => {
  const segs = cache.get(recitationId)?.[ayahKey(surah, ayah)];
  if (!segs || segs.length === 0) return null;
  let bestWord: number | null = null;
  let bestStart = -1;
  for (const [wordIndex, start, end] of segs) {
    if (positionMs >= start && positionMs < end) return wordIndex; // inside this word
    if (start <= positionMs && start > bestStart) {
      bestStart = start;
      bestWord = wordIndex;
    }
  }
  return bestWord;
};

export const quranAudioTimings = { load, wordAt };
