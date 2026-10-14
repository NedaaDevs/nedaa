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

/** Sends each status in turn to every captured listener. */
export const emitAppState = (...statuses: AppStateStatus[]) => {
  for (const status of statuses) listeners.forEach((listener) => listener(status));
};
