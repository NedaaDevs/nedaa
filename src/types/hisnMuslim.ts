export type HisnCategory = {
  id: number;
  titleAr: string;
  titleEn: string;
  audioUrl: string | null;
};

export type HisnAthkar = {
  id: number;
  categoryId: number;
  arabicText: string;
  transliteration: string;
  translation: string;
  repeatCount: number;
  audioUrl: string | null;
  sortOrder: number;
};

export type HisnSearchResult = HisnAthkar & {
  categoryTitleAr: string;
  categoryTitleEn: string;
};

export type MyAthkarItem = {
  id: number;
  sourceAthkarId: number;
  sourceCategoryId: number;
  userCount: number;
  sortOrder: number;
};

export type MyAthkarDisplayItem = MyAthkarItem & {
  arabicText: string;
  transliteration: string;
  translation: string;
  categoryTitleAr: string;
  categoryTitleEn: string;
  audioUrl: string | null;
};

export type MyAthkarProgress = {
  myAthkarId: number;
  currentCount: number;
  totalCount: number;
  completed: boolean;
};
