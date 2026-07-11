import { QuranManifestService } from "@/services/quran-manifest";
import { QURAN_GRANULARITY } from "@/types/quran-audio";
import type { QuranReciter, QuranRecitation } from "@/types/quran-audio";
import { useDebugModeStore } from "@/stores/debugMode";

// Locales rendered in Arabic script (matches localizedSurahName).
const ARABIC_SCRIPT_LOCALES = ["ar", "ur"];

const fetchReciters = (): Promise<QuranReciter[]> => QuranManifestService.getReciters();

const allRecitations = async (): Promise<QuranRecitation[]> =>
  (await fetchReciters()).flatMap((r) => r.recitations);

const getRecitationById = async (id: string): Promise<QuranRecitation | null> =>
  (await allRecitations()).find((r) => r.id === id) ?? null;

const getDefaultRecitation = async (): Promise<QuranRecitation | null> => {
  const audio = await QuranManifestService.getAudio();
  const all = (audio?.reciters ?? []).flatMap((r) => r.recitations);
  if (all.length === 0) return null;
  return all.find((r) => r.id === audio?.defaultRecitationId) ?? all[0];
};

// In production only published recitations are user-facing; dev builds and the
// hidden debug mode show all, so a reciter can be tested before publishing
// (mirrors the manifest edition gate).
const isVisible = (r: QuranRecitation): boolean =>
  __DEV__ || useDebugModeStore.getState().isEnabled || r.published;

// A reciter can carry more than one ayah recitation of the same style (e.g. a
// re-upload); collapse each (style, riwayah) to one entry, preferring the one with
// word timings so the reader gets word-level whenever it exists.
const dedupeByStyle = (recs: QuranRecitation[]): QuranRecitation[] => {
  const best = new Map<string, QuranRecitation>();
  for (const rec of recs) {
    const key = `${rec.style}:${rec.riwayah}`;
    const existing = best.get(key);
    if (!existing || (!existing.timings && rec.timings)) best.set(key, rec);
  }
  return [...best.values()];
};

// Recitations the reader can use: derived from the reader reciters so both surfaces
// agree (ayah-granular, visible, de-duplicated).
const readerRecitations = async (): Promise<QuranRecitation[]> =>
  (await readerReciters()).flatMap((r) => r.recitations);

// Reciters for the Listen surface: gapless (surah) recitations only — per-ayah
// recitations are the reader's. Reciters left with no gapless recitation drop out.
const listenReciters = async (): Promise<QuranReciter[]> =>
  (await fetchReciters())
    .map((r) => ({
      ...r,
      recitations: r.recitations.filter(
        (rec) => rec.granularity === QURAN_GRANULARITY.SURAH && isVisible(rec)
      ),
    }))
    .filter((r) => r.recitations.length > 0);

// Reciters for the reader: ayah-granular recitations only (the only ones that can
// drive per-ayah/word read-along). Reciters with no ayah recitation drop out.
const readerReciters = async (): Promise<QuranReciter[]> =>
  (await fetchReciters())
    .map((r) => ({
      ...r,
      recitations: dedupeByStyle(
        r.recitations.filter((rec) => rec.granularity === QURAN_GRANULARITY.AYAH && isVisible(rec))
      ),
    }))
    .filter((r) => r.recitations.length > 0);

const reciterOf = async (recitationId: string): Promise<QuranReciter | null> =>
  (await fetchReciters()).find((r) => r.recitations.some((x) => x.id === recitationId)) ?? null;

// Arabic name for Arabic-script locales (ar/ur), English otherwise.
const localizedName = (reciter: QuranReciter, locale: string): string =>
  ARABIC_SCRIPT_LOCALES.includes(locale.split("-")[0]) ? reciter.nameArabic : reciter.nameEnglish;

export const quranReciterRegistry = {
  fetchReciters,
  getRecitationById,
  getDefaultRecitation,
  readerRecitations,
  listenReciters,
  readerReciters,
  reciterOf,
  localizedName,
};
