import { useEffect } from "react";

import { ATHKAR_TYPE } from "@/constants/Athkar";
import { SESSION_SOURCE, type CollectionSource } from "@/constants/AthkarSession";
import type { SessionLoad, SessionPort } from "@/hooks/useAthkarSession";
import { useInitializeAthkarStores } from "@/hooks/useInitializeAthkarStores";
import { useAthkarStore } from "@/stores/athkar";
import {
  collectionSession,
  placeIndex,
  useAthkarCollectionSession,
} from "@/stores/athkarCollectionSession";
import { useCustomAthkarStore } from "@/stores/custom-athkar";
import { useMyAthkarStore } from "@/stores/my-athkar";
import { collectionKey, customCollection, hisnCollection } from "@/utils/athkarCollections";
import { audioOwnsCount, toCounts, toSessionItems } from "@/utils/athkarSession";

const useHasDailySession = () =>
  useAthkarStore((s) => {
    const list = s.currentType === ATHKAR_TYPE.MORNING ? s.morningAthkarList : s.eveningAthkarList;
    return s.progressDay !== null && list.length > 0;
  });

/** Opens the period on its first unfinished dhikr, from the last place. */
export const useSessionOpening = () => {
  const type = useAthkarStore((s) => s.currentType);
  const jumpToIndex = useAthkarStore((s) => s.jumpToIndex);
  const findOptimalAthkarIndex = useAthkarStore((s) => s.findOptimalAthkarIndex);
  const hasSession = useHasDailySession();

  useEffect(() => {
    if (hasSession) jumpToIndex(findOptimalAthkarIndex(type));
  }, [hasSession, type, jumpToIndex, findOptimalAthkarIndex]);
};

/** Opens a saved topic on today's counts, on its first unfinished dhikr from the last place. */
export const useHisnOpening = (categoryId: number, ready: boolean) => {
  useEffect(() => {
    if (ready) collectionSession.open({ kind: SESSION_SOURCE.HISN, categoryId });
  }, [ready, categoryId]);
};

/** Opens a custom group on today's counts, on its first unfinished dhikr from the last place. */
export const useCustomOpening = (groupId: number, ready: boolean) => {
  useEffect(() => {
    if (ready) collectionSession.open({ kind: SESSION_SOURCE.CUSTOM, groupId });
  }, [ready, groupId]);
};

/** The period the Athkar store is on: morning or evening. */
export const useDailyPort = (): SessionPort => {
  const type = useAthkarStore((s) => s.currentType);
  const list = useAthkarStore((s) =>
    type === ATHKAR_TYPE.MORNING ? s.morningAthkarList : s.eveningAthkarList
  );
  const progress = useAthkarStore((s) => s.currentProgress);
  const index = useAthkarStore((s) => s.currentAthkarIndex);
  const advancePending = useAthkarStore((s) => s.advancePending);
  const playerState = useAthkarStore((s) => s.playerState);
  const currentAthkarId = useAthkarStore((s) => s.currentAthkarId);
  const loadingAthkarId = useAthkarStore((s) => s.loadingAthkarId);
  const add = useAthkarStore((s) => s.incrementCount);
  const addMany = useAthkarStore((s) => s.incrementCountBy);
  const undo = useAthkarStore((s) => s.decrementCount);
  const jumpTo = useAthkarStore((s) => s.jumpToIndex);
  const flush = useAthkarStore((s) => s.flushCounts);
  const syncDay = useAthkarStore((s) => s.syncDay);

  return {
    ready: useHasDailySession(),
    items: toSessionItems(list),
    counts: toCounts(progress),
    index,
    advancePending,
    audioOwnsCount: (id) => audioOwnsCount({ playerState, currentAthkarId, loadingAthkarId }, id),
    add: (id) => add(id),
    addMany,
    undo,
    jumpTo,
    flush,
    syncDay,
  };
};

/** No audio session reads a collection, so none owns a count. */
const noAudio = () => false;

/** A collection's port, with its store's failed load and the retry. */
export type CollectionPort = SessionPort & { load: SessionLoad };

type CollectionDay = Pick<SessionPort, "items" | "counts" | "flush" | "syncDay"> & {
  loaded: boolean;
  failed: boolean;
  retry: () => Promise<void>;
};

/** A collection's port: its own store's counts, and the place the collection store keeps. */
const useCollectionPort = (
  source: CollectionSource,
  { loaded, failed, retry, ...day }: CollectionDay
): CollectionPort => {
  const key = collectionKey(source);
  const place = useAthkarCollectionSession((s) => s.places[key]);
  const advancePending = useAthkarCollectionSession((s) => s.pending === key);
  return {
    ...day,
    // What a failed load left in memory may be missing or out of date.
    ready: loaded && !failed,
    load: { settled: failed, retry: () => void retry() },
    index: placeIndex(day.items, place),
    advancePending,
    audioOwnsCount: noAudio,
    add: (id) => collectionSession.add(source, id, 1),
    addMany: (id, by) => collectionSession.add(source, id, by),
    undo: (id) => collectionSession.undo(source, id),
    jumpTo: (to) => collectionSession.jumpTo(source, to),
  };
};

/** A topic of Hisn al-Muslim a person saved. */
export const useHisnPort = (categoryId: number): CollectionPort => {
  const { isMyAthkarInit, myAthkarFailed, retry } = useInitializeAthkarStores();
  const items = useMyAthkarStore((s) => s.items);
  const displayData = useMyAthkarStore((s) => s.displayData);
  const progress = useMyAthkarStore((s) => s.progress);
  const flush = useMyAthkarStore((s) => s.flushCounts);
  const syncDay = useMyAthkarStore((s) => s.syncDay);

  return useCollectionPort(
    { kind: SESSION_SOURCE.HISN, categoryId },
    {
      loaded: isMyAthkarInit,
      failed: myAthkarFailed,
      retry,
      ...hisnCollection({ items, displayData, progress }, categoryId),
      flush,
      syncDay,
    }
  );
};

/** A group a person wrote. */
export const useCustomPort = (groupId: number): CollectionPort => {
  const { isCustomInit, customFailed, retry } = useInitializeAthkarStores();
  const items = useCustomAthkarStore((s) => s.items);
  const progress = useCustomAthkarStore((s) => s.progress);
  const flush = useCustomAthkarStore((s) => s.flushCounts);
  const syncDay = useCustomAthkarStore((s) => s.syncDay);

  return useCollectionPort(
    { kind: SESSION_SOURCE.CUSTOM, groupId },
    {
      loaded: isCustomInit,
      failed: customFailed,
      retry,
      ...customCollection({ items, progress }, groupId),
      flush,
      syncDay,
    }
  );
};
