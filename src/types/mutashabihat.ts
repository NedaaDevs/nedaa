export type MutashabihatMember = {
  surahNumber: number;
  ayahNumber: number;
  ord: number;
  text: string;
  page: number;
  surahNameArabic: string;
  surahNameTransliterated: string;
  highlightSpans: [number, number][] | null; // shared-phrase word spans [fromWord, toWord]
};

export type MutashabihatGroup = {
  id: string;
  keyword: string | null;
  rule: string | null;
  showContext: boolean;
  curated: boolean;
  members: MutashabihatMember[];
};
