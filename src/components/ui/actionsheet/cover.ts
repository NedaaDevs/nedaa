import { useEffect, useSyncExternalStore } from "react";

// How many sheets cover the app now; readers skip the app while any does.
let openSheets = 0;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const isCovered = () => openSheets > 0;

const cover = (delta: 1 | -1) => {
  openSheets += delta;
  listeners.forEach((listener) => listener());
};

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
