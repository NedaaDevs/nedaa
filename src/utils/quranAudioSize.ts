import type { SurahMeta } from "@/types/quran";
import type { QuranRecitation } from "@/types/quran-audio";

const SURAH_COUNT = 114;

export type SurahSizeResolver = {
  sizeOf: (surah: number) => number; // bytes; 0 when unknown
  exact: boolean; // true = manifest sizes; false = page-span estimate (show "~")
};

// Resolve a per-surah download size (bytes). Prefers the manifest's exact
// `surahBytes`; when absent, distributes the recitation's approximate total
// across surahs by mushaf page span — a good proxy for recitation length, and
// far better than ayah count (short surahs pack many tiny ayahs into one page).
export const buildSurahSizeResolver = (
  metaBySurah: Record<number, SurahMeta>,
  recitation: QuranRecitation | null
): SurahSizeResolver => {
  const exact = recitation?.surahBytes;
  if (exact && exact.length >= SURAH_COUNT) {
    return { sizeOf: (surah) => Math.max(0, exact[surah - 1] ?? 0), exact: true };
  }

  const bytesApprox = recitation?.bytesApprox ?? 0;
  const weight = (m?: SurahMeta): number => (m ? Math.max(1, m.pageEnd - m.pageStart + 1) : 1);
  let total = 0;
  for (let n = 1; n <= SURAH_COUNT; n++) total += weight(metaBySurah[n]);
  return {
    sizeOf: (surah) =>
      total > 0 && bytesApprox > 0
        ? Math.round((bytesApprox * weight(metaBySurah[surah])) / total)
        : 0,
    exact: false,
  };
};
