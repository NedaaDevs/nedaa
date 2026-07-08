import type { QuranRecitation, QuranQueueItem } from "@/types/quran-audio";

const trimSlashes = (s: string): string => s.replace(/^\/+|\/+$/g, "");

export const remoteAyahUrl = (
  baseUrl: string,
  recitation: QuranRecitation,
  surah: number,
  ayah: number
): string =>
  `${trimSlashes(baseUrl)}/${trimSlashes(recitation.basePath)}/${surah}_${ayah}.${recitation.fileFormat}`;

// Gapless (surah-granular) recitations have one file per surah.
export const remoteSurahUrl = (
  baseUrl: string,
  recitation: QuranRecitation,
  surah: number
): string =>
  `${trimSlashes(baseUrl)}/${trimSlashes(recitation.basePath)}/${surah}.${recitation.fileFormat}`;

// Inclusive [fromAyah, toAyah] within one surah, in reading order.
export const buildAyahRange = (
  surah: number,
  fromAyah: number,
  toAyah: number,
  urlFor: (surah: number, ayah: number) => string
): QuranQueueItem[] => {
  const items: QuranQueueItem[] = [];
  for (let ayah = fromAyah; ayah <= toAyah; ayah++) {
    items.push({ surah, ayah, url: urlFor(surah, ayah) });
  }
  return items;
};
