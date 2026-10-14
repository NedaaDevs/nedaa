import { AppState, type AppStateStatus } from "react-native";

import { APP_STATE } from "@/constants/AppState";

/** Resolves on the app's return, on abort, or at `graceMs` if it never left. */
export const nextForeground = (graceMs: number, signal?: AbortSignal): Promise<void> =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    // The app may already be away when the wait starts.
    let left = AppState.currentState !== APP_STATE.ACTIVE;

    const finish = () => {
      clearTimeout(timer);
      subscription.remove();
      signal?.removeEventListener("abort", finish);
      resolve();
    };

    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next !== APP_STATE.ACTIVE) left = true;
      else if (left) finish();
    });
    // Still here after `graceMs`: the app never left.
    const timer = setTimeout(() => {
      if (!left) finish();
    }, graceMs);
    signal?.addEventListener("abort", finish, { once: true });
  });
