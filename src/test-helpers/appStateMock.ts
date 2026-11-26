import { AppState, type AppStateStatus } from "react-native";

const listeners: ((status: AppStateStatus) => void)[] = [];

/** Captures each AppState change listener added from here on. */
export const captureAppState = () => {
  listeners.length = 0;
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    listeners.push(listener);
    return { remove: () => {} };
  });
};

const CURRENT_STATE = Object.getOwnPropertyDescriptor(AppState, "currentState");

/** Sets the status a new reader finds; the preset mocks it as a function. */
export const setAppState = (status: AppStateStatus) => {
  Object.defineProperty(AppState, "currentState", { value: status, configurable: true });
};

/** Puts the preset's `currentState` back. */
export const restoreAppState = () => {
  if (CURRENT_STATE) Object.defineProperty(AppState, "currentState", CURRENT_STATE);
};

/** Sends each status in turn to every captured listener. */
export const emitAppState = (...statuses: AppStateStatus[]) => {
  for (const status of statuses) listeners.forEach((listener) => listener(status));
};
