import { create } from "zustand";

import { SESSION_SOURCE, type CollectionSource } from "@/constants/AthkarSession";
import { useAthkarStore } from "@/stores/athkar";
import { useCustomAthkarStore } from "@/stores/custom-athkar";
import { useMyAthkarStore } from "@/stores/my-athkar";
import {
  collectionKey,
  customCollection,
  hisnCollection,
  type Collection,
} from "@/utils/athkarCollections";
import { createAdvance, nextOpenIndex, type Counts, type SessionItem } from "@/utils/athkarSession";

/** A collection's dhikr and the day's counts, as its own store holds them now. */
const readCollection = (source: CollectionSource): Collection => {
  switch (source.kind) {
    case SESSION_SOURCE.HISN:
      return hisnCollection(useMyAthkarStore.getState(), source.categoryId);
    case SESSION_SOURCE.CUSTOM:
      return customCollection(useCustomAthkarStore.getState(), source.groupId);
  }
};

/** The store that saves a collection's counts; both stop a count at its target. */
const countsOf = (source: CollectionSource) => {
  switch (source.kind) {
    case SESSION_SOURCE.HISN:
      return useMyAthkarStore.getState();
    case SESSION_SOURCE.CUSTOM:
      return useCustomAthkarStore.getState();
  }
};

/** A dhikr a collection's session is on, and where it stood when it was chosen. */
export type CollectionPlace = { id: string; index: number };

/** The place's dhikr; once it is removed, the one now in its position. */
export const placeIndex = (items: readonly SessionItem[], place: CollectionPlace | undefined) => {
  if (!place) return 0;
  const at = items.findIndex((item) => item.id === place.id);
  return at === -1 ? Math.max(0, Math.min(place.index, items.length - 1)) : at;
};

type CollectionSessionState = {
  /** The last place in each collection opened since the app started, by its key. */
  places: Readonly<Record<string, CollectionPlace>>;
  /** The collection whose finished dhikr is held before the next one opens. */
  pending: string | null;
};

/** Where a collection's session is. Its counts stay in the store that saves them. */
export const useAthkarCollectionSession = create<CollectionSessionState>()(() => ({
  places: {},
  pending: null,
}));

const { getState, setState } = useAthkarCollectionSession;

// Every action that changes the place cancels it.
const advance = createAdvance();

const placeAt = (key: string, items: readonly SessionItem[], index: number) =>
  setState((state) => ({
    places: { ...state.places, [key]: { id: items[index].id, index } },
    pending: null,
  }));

const countOf = (counts: Counts, item: SessionItem) => counts[item.id] ?? 0;

/**
 * True when the counts in memory belong to another day: `run` runs once the new
 * day has loaded, and is dropped when the load fails.
 */
const deferToNewDay = (source: CollectionSource, run: () => void) => {
  const store = countsOf(source);
  if (!store.isAnotherDay()) return false;
  advance.cancel();
  setState({ pending: null });
  void store.syncDay().then(() => {
    if (!countsOf(source).isAnotherDay()) run();
  });
  return true;
};

/** Holds the finished dhikr for the pause, then opens the next unfinished one. */
const startAdvance = (source: CollectionSource, from: number) => {
  if (!useAthkarStore.getState().settings.autoMoveToNext) return;
  const key = collectionKey(source);
  setState({ pending: key });
  advance.start(() => {
    const { items, counts } = readCollection(source);
    const next = nextOpenIndex(items, counts, from);
    if (next === null) setState({ pending: null });
    else placeAt(key, items, next);
  });
};

/** Counts toward a dhikr; reaching its target starts the move to the next. */
const add = (source: CollectionSource, id: string, by: number) => {
  if (deferToNewDay(source, () => add(source, id, by))) return;
  // The finished dhikr is still on screen; a tap now belongs to no dhikr.
  if (getState().pending !== null || by <= 0) return;
  const before = readCollection(source);
  const index = before.items.findIndex((item) => item.id === id);
  if (index === -1) return;
  // A hold on a finished dhikr adds nothing; a tap there moves on.
  const wasDone = countOf(before.counts, before.items[index]) >= before.items[index].target;
  if (wasDone && by > 1) return;

  countsOf(source).incrementCountBy(Number(id), by);
  const { items, counts } = readCollection(source);
  if (countOf(counts, items[index]) >= items[index].target) startAdvance(source, index);
};

const undo = (source: CollectionSource, id: string) => {
  if (deferToNewDay(source, () => undo(source, id))) return;
  advance.cancel();
  setState({ pending: null });
  countsOf(source).decrementCount(Number(id));
};

/** Moves to a dhikr of the collection. An index outside it changes nothing. */
const jumpTo = (source: CollectionSource, index: number) => {
  const { items } = readCollection(source);
  if (!Number.isInteger(index) || index < 0 || index >= items.length) return;
  advance.cancel();
  placeAt(collectionKey(source), items, index);
};

/** Opens the collection on today's counts, on its first unfinished dhikr from the last place. */
const open = (source: CollectionSource) => {
  if (deferToNewDay(source, () => open(source))) return;
  const { items, counts } = readCollection(source);
  if (items.length === 0) return;
  const key = collectionKey(source);
  const last = placeIndex(items, getState().places[key]);
  const unfinished = countOf(counts, items[last]) < items[last].target;
  advance.cancel();
  placeAt(key, items, unfinished ? last : (nextOpenIndex(items, counts, last) ?? last));
};

export const collectionSession = { add, undo, jumpTo, open };
