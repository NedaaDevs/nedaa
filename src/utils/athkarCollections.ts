import { DEFAULT_ATHKAR_GROUP_ORDER } from "@/constants/Athkar";
import { DHIKR_TEXT, SESSION_SOURCE, type CollectionSource } from "@/constants/AthkarSession";
import type { CustomAthkarItem, CustomAthkarProgress } from "@/types/athkar";
import type { HisnAthkar, MyAthkarItem, MyAthkarProgress } from "@/types/hisnMuslim";
import type { Counts, SessionItem } from "@/utils/athkarSession";

/** Names a collection's session among the others. */
export const collectionKey = (source: CollectionSource): string => {
  switch (source.kind) {
    case SESSION_SOURCE.HISN:
      return `${source.kind}:${source.categoryId}`;
    case SESSION_SOURCE.CUSTOM:
      return `${source.kind}:${source.groupId}`;
  }
};

type DayCount = { currentCount: number; totalCount: number };

const plainItem = (
  id: number,
  day: DayCount,
  arabic: string,
  translation: string | null
): SessionItem => ({
  id: String(id),
  target: day.totalCount,
  texts: [{ kind: DHIKR_TEXT.RAW, arabic, translation }],
  itemsPerRound: 1,
  groupOrder: DEFAULT_ATHKAR_GROUP_ORDER,
});

/** A saved topic's dhikr, in order; one with no text or no row for the day is left out. */
const hisnSessionItems = (
  saved: readonly MyAthkarItem[],
  texts: ReadonlyMap<number, HisnAthkar>,
  progress: readonly MyAthkarProgress[]
): SessionItem[] =>
  saved.flatMap((item) => {
    const text = texts.get(item.sourceAthkarId);
    const day = progress.find((p) => p.myAthkarId === item.id);
    return text && day ? [plainItem(item.id, day, text.arabicText, text.translation)] : [];
  });

/** A custom group's dhikr, in order; one with no row for the day is left out. */
const customSessionItems = (
  items: readonly CustomAthkarItem[],
  progress: readonly CustomAthkarProgress[]
): SessionItem[] =>
  items.flatMap((item) => {
    const day = progress.find((p) => p.customItemId === item.id);
    return day ? [plainItem(item.id, day, item.arabicText, null)] : [];
  });

const hisnCounts = (progress: readonly MyAthkarProgress[]): Counts =>
  Object.fromEntries(progress.map((p) => [String(p.myAthkarId), p.currentCount]));

const customCounts = (progress: readonly CustomAthkarProgress[]): Counts =>
  Object.fromEntries(progress.map((p) => [String(p.customItemId), p.currentCount]));

export type Collection = { items: readonly SessionItem[]; counts: Counts };

type HisnState = {
  items: readonly MyAthkarItem[];
  displayData: ReadonlyMap<number, HisnAthkar>;
  progress: readonly MyAthkarProgress[];
};

/** A saved topic as a session: its dhikr and the day's counts. */
export const hisnCollection = (state: HisnState, categoryId: number): Collection => ({
  items: hisnSessionItems(
    state.items.filter((item) => item.sourceCategoryId === categoryId),
    state.displayData,
    state.progress
  ),
  counts: hisnCounts(state.progress),
});

type CustomState = {
  items: readonly CustomAthkarItem[];
  progress: readonly CustomAthkarProgress[];
};

/** A custom group as a session: its dhikr and the day's counts. */
export const customCollection = (state: CustomState, groupId: number): Collection => ({
  items: customSessionItems(
    state.items.filter((item) => item.groupId === groupId),
    state.progress
  ),
  counts: customCounts(state.progress),
});
