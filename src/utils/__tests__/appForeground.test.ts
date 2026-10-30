import { AppState, type AppStateStatus } from "react-native";

import { APP_STATE } from "@/constants/AppState";
import { SETTINGS_OPEN_GRACE_MS } from "@/constants/Onboarding";
import { outcomeOf } from "@/test-helpers/promises";
import { nextForeground, waitWhileActive } from "@/utils/appForeground";

const listeners: ((status: AppStateStatus) => void)[] = [];
const remove = jest.fn();
const emit = (status: AppStateStatus) => [...listeners].forEach((listener) => listener(status));
/** Fails unless the wait resolved once; strict, so a rejection never passes. */
const expectResolved = (wait: jest.Mock) =>
  expect(wait.mock.calls).toStrictEqual([[{ value: undefined }]]);
/** True once the wait holds no listener and no timer. */
const released = () => listeners.length === 0 && jest.getTimerCount() === 0;
/** The state the app is in when the wait starts. */
const startIn = (status: AppStateStatus) => {
  (AppState as { currentState: AppStateStatus }).currentState = status;
};

beforeEach(() => {
  jest.useFakeTimers();
  startIn(APP_STATE.ACTIVE);
  listeners.length = 0;
  remove.mockClear();
  jest
    .mocked(AppState.addEventListener)
    .mockReset()
    .mockImplementation((_type, listener) => {
      const own = listener as (status: AppStateStatus) => void;
      listeners.push(own);
      return {
        remove: () => {
          remove();
          listeners.splice(listeners.indexOf(own), 1);
        },
      };
    });
});
afterEach(() => jest.useRealTimers());

// A settings screen that never opened.
it("resolves after the grace when the app never left", async () => {
  const wait = outcomeOf(nextForeground(SETTINGS_OPEN_GRACE_MS));

  await jest.advanceTimersByTimeAsync(SETTINGS_OPEN_GRACE_MS - 1);
  expect(wait).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1);
  expectResolved(wait);
  expect(released()).toBe(true);
});

it("waits past the grace once the app has left, and resolves on its return", async () => {
  const wait = outcomeOf(nextForeground(SETTINGS_OPEN_GRACE_MS));

  emit(APP_STATE.BACKGROUND);
  await jest.advanceTimersByTimeAsync(SETTINGS_OPEN_GRACE_MS * 10);
  expect(wait).not.toHaveBeenCalled();

  emit(APP_STATE.ACTIVE);
  await jest.advanceTimersByTimeAsync(0);
  expectResolved(wait);
  expect(released()).toBe(true);
});

it("clears its timer on a return inside the grace", async () => {
  const wait = outcomeOf(nextForeground(SETTINGS_OPEN_GRACE_MS));

  emit(APP_STATE.INACTIVE);
  emit(APP_STATE.ACTIVE);
  await jest.advanceTimersByTimeAsync(0);

  expectResolved(wait);
  expect(released()).toBe(true);
});

it("counts a leave that began before the wait", async () => {
  startIn(APP_STATE.INACTIVE);
  const wait = outcomeOf(nextForeground(SETTINGS_OPEN_GRACE_MS));

  await jest.advanceTimersByTimeAsync(SETTINGS_OPEN_GRACE_MS * 10);
  expect(wait).not.toHaveBeenCalled();

  emit(APP_STATE.ACTIVE);
  await jest.advanceTimersByTimeAsync(0);
  expectResolved(wait);
  expect(released()).toBe(true);
});

it("does not count an active report without a leave", async () => {
  const wait = outcomeOf(nextForeground(SETTINGS_OPEN_GRACE_MS));

  emit(APP_STATE.ACTIVE);
  await jest.advanceTimersByTimeAsync(0);

  expect(wait).not.toHaveBeenCalled();
});

it("lets go at once when its signal aborts, also while the app is away", async () => {
  const controller = new AbortController();
  const wait = outcomeOf(nextForeground(SETTINGS_OPEN_GRACE_MS, controller.signal));
  emit(APP_STATE.BACKGROUND);

  controller.abort();
  await jest.advanceTimersByTimeAsync(0);

  expectResolved(wait);
  expect(released()).toBe(true);
});

it("resolves at once and listens to nothing for a signal already aborted", async () => {
  const controller = new AbortController();
  controller.abort();

  const wait = outcomeOf(nextForeground(SETTINGS_OPEN_GRACE_MS, controller.signal));
  await jest.advanceTimersByTimeAsync(0);

  expectResolved(wait);
  expect(AppState.addEventListener).not.toHaveBeenCalled();
  expect(released()).toBe(true);
});

it("removes its listener once, whichever way it settles", async () => {
  const controller = new AbortController();
  const wait = outcomeOf(nextForeground(SETTINGS_OPEN_GRACE_MS, controller.signal));

  emit(APP_STATE.BACKGROUND);
  emit(APP_STATE.ACTIVE);
  controller.abort();
  await jest.advanceTimersByTimeAsync(SETTINGS_OPEN_GRACE_MS);

  expectResolved(wait);
  expect(remove).toHaveBeenCalledTimes(1);
});

describe("waitWhileActive", () => {
  const WAIT_MS = 30_000;

  it("waits while the app stays active, and stops when it leaves", async () => {
    const stayed = outcomeOf(waitWhileActive(WAIT_MS));
    await jest.advanceTimersByTimeAsync(WAIT_MS - 1);
    expect(stayed).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(stayed.mock.calls).toStrictEqual([[{ value: true }]]);
    expect(released()).toBe(true);

    const left = outcomeOf(waitWhileActive(WAIT_MS));
    emit(APP_STATE.BACKGROUND);
    await jest.advanceTimersByTimeAsync(0);
    expect(left.mock.calls).toStrictEqual([[{ value: false }]]);
    expect(released()).toBe(true);
  });

  it("stops on an inactive report", async () => {
    const left = outcomeOf(waitWhileActive(WAIT_MS));
    emit(APP_STATE.INACTIVE);
    await jest.advanceTimersByTimeAsync(0);

    expect(left.mock.calls).toStrictEqual([[{ value: false }]]);
  });

  it("answers false at once when the app is already away", async () => {
    startIn(APP_STATE.BACKGROUND);
    const left = outcomeOf(waitWhileActive(WAIT_MS));
    await jest.advanceTimersByTimeAsync(0);

    expect(left.mock.calls).toStrictEqual([[{ value: false }]]);
    expect(AppState.addEventListener).not.toHaveBeenCalled();
    expect(released()).toBe(true);
  });
});
