import { useEffect, useId, useSyncExternalStore } from "react";

// How many sheets cover the app now; readers skip the app while any does.
let openSheets = 0;
// The sheet layers mounted now, top last.
let layers: string[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const isCovered = () => openSheets > 0;

const cover = (delta: 1 | -1) => {
  openSheets += delta;
  notify();
};

const topLayer = () => layers.at(-1);

/** Covers the app while `open`; closing or unmounting uncovers it. */
export const useCoverApp = (open: boolean) => {
  useEffect(() => {
    if (!open) return;
    cover(1);
    return () => cover(-1);
  }, [open]);
};

/** True while an open sheet covers the app. */
export const useAppCovered = (): boolean => useSyncExternalStore(subscribe, isCovered);

/** Registers a sheet layer while mounted; true while it is the top one. */
export const useSheetLayer = (): boolean => {
  const id = useId();
  useEffect(() => {
    layers = [...layers, id];
    notify();
    return () => {
      layers = layers.filter((layer) => layer !== id);
      notify();
    };
  }, [id]);
  return useSyncExternalStore(subscribe, topLayer) === id;
};

/** True while any sheet layer is mounted, from present to dismissed. */
export const useSheetLayerUp = (): boolean =>
  useSyncExternalStore(subscribe, topLayer) !== undefined;
