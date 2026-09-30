import { useEffect, useRef } from "react";
import { AppState, type NativeEventSubscription } from "react-native";

import { APP_STATE } from "@/constants/AppState";

/** Calls back on the app's next return; one wait at a time, none unmounted. */
export const useOnReturn = () => {
  const waiting = useRef<NativeEventSubscription | null>(null);

  const stop = () => {
    waiting.current?.remove();
    waiting.current = null;
  };

  useEffect(() => {
    const wait = waiting;
    return () => wait.current?.remove();
  }, []);

  return (callback: () => void) => {
    stop();
    waiting.current = AppState.addEventListener("change", (state) => {
      if (state !== APP_STATE.ACTIVE) return;
      stop();
      callback();
    });
  };
};
