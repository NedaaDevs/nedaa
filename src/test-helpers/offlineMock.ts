import { useSyncExternalStore } from "react";
import { act } from "@testing-library/react-native";

/** The connectivity a test sets; a mounted screen reads each change. */
const connectivity = { offline: false, listeners: new Set<() => void>() };

const subscribe = (listener: () => void) => {
  connectivity.listeners.add(listener);
  return () => void connectivity.listeners.delete(listener);
};

/** Stands in for the hook: true while the test has the device offline. */
export const useIsOffline = () => useSyncExternalStore(subscribe, () => connectivity.offline);

/** Changes the connectivity, before a render or under a mounted screen. */
export const setOffline = (offline: boolean) =>
  act(async () => {
    connectivity.offline = offline;
    connectivity.listeners.forEach((listener) => listener());
  });

/** Puts the device back online; run it in `beforeEach`. */
export const resetOffline = () => {
  connectivity.offline = false;
};
