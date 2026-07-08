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

// Recitations the reader can use: ayah-granular.
// TODO(quran-audio-published): re-add `r.published` (show unpublished only in __DEV__).
const readerRecitations = async (): Promise<QuranRecitation[]> =>
  (await allRecitations()).filter(isReaderEligible);

// Reciters for the Listen surface: gapless (surah) recitations only — per-ayah
// recitations are the reader's. Reciters left with no gapless recitation drop out.
const listenReciters = async (): Promise<QuranReciter[]> =>
  (await fetchReciters())
    .map((r) => ({
      ...r,
      recitations: r.recitations.filter((rec) => rec.granularity === QURAN_GRANULARITY.SURAH),
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
  reciterOf,
  localizedName,
};
