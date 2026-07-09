import { QuranManifestService } from "@/services/quran-manifest";
import { isReaderEligible, QURAN_GRANULARITY } from "@/types/quran-audio";
import type { QuranReciter, QuranRecitation } from "@/types/quran-audio";

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

// In production only published recitations are user-facing; dev shows all so we
// can test before publishing (mirrors the manifest edition gate).
const isVisible = (r: QuranRecitation): boolean => __DEV__ || r.published;

// Recitations the reader can use: ayah-granular + visible.
const readerRecitations = async (): Promise<QuranRecitation[]> =>
  (await allRecitations()).filter((r) => isReaderEligible(r) && isVisible(r));

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
      recitations: r.recitations.filter(
        (rec) => rec.granularity === QURAN_GRANULARITY.AYAH && isVisible(rec)
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
