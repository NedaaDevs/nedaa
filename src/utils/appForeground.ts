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

/** True after `ms` with the app active throughout; false as soon as it leaves. */
export const waitWhileActive = (ms: number): Promise<boolean> =>
  new Promise<boolean>((resolve) => {
    if (AppState.currentState !== APP_STATE.ACTIVE) {
      resolve(false);
      return;
    }
    const finish = (stayed: boolean) => {
      clearTimeout(timer);
      subscription.remove();
      resolve(stayed);
    };
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next !== APP_STATE.ACTIVE) finish(false);
    });
    const timer = setTimeout(() => finish(true), ms);
  });

/** Stands for a read the app left before it settled. */
export const APP_LEFT = Symbol("appLeft");

/** The read's value, or APP_LEFT when the app leaves first or is away. */
export const unlessLeft = <T>(read: () => Promise<T>): Promise<T | typeof APP_LEFT> =>
  new Promise<T | typeof APP_LEFT>((resolve, reject) => {
    if (AppState.currentState !== APP_STATE.ACTIVE) {
      resolve(APP_LEFT);
      return;
    }
    let done = false;
    const settle = (finish: () => void) => {
      if (done) return;
      done = true;
      subscription.remove();
      finish();
    };
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next !== APP_STATE.ACTIVE) settle(() => resolve(APP_LEFT));
    });
    read().then(
      (value) => settle(() => resolve(value)),
      (error: unknown) => settle(() => reject(error))
    );
  });
