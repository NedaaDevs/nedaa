import React, { Component, useEffect, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { act, render } from "@testing-library/react-native";

import { useNotificationEditSession } from "@/hooks/useNotificationEditSession";
import { usePrayerAlertSettings, type PrayerAlertSettings } from "@/hooks/usePrayerAlertSettings";
import { useNotificationStore } from "@/stores/notification";
import { NOTIFICATION_FIELD, NOTIFICATION_TYPE } from "@/constants/Notification";
import { PRAYER_ID } from "@/constants/Prayer";
import { APP_STATE } from "@/constants/AppState";
import type { PrayerSoundKey } from "@/constants/sounds";
import { scheduleAllNotifications } from "@/utils/notificationScheduler";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("expo-linking", () => ({ openSettings: jest.fn() }));
jest.mock("@/utils/notifications", () => ({ cancelAllScheduledNotifications: jest.fn() }));
jest.mock("@/utils/notificationScheduler", () => ({
  scheduleAllNotifications: jest.fn(() => Promise.resolve({ success: true, scheduledCount: 0 })),
  shouldReschedule: jest.fn(() => false),
}));
jest.mock("@/utils/customSoundManager", () => ({ buildUsedSoundsSet: jest.fn(() => new Set()) }));
jest.mock("@/services/qada-db", () => ({
  QadaDB: {
    flush: jest.fn(),
    getSettings: jest.fn(() => Promise.resolve(null)),
    getRemainingCount: jest.fn(() => Promise.resolve(0)),
  },
}));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: jest.fn(() => ({ locationDetails: { timezone: "UTC" } })) },
}));
jest.mock("@/stores/prayerTimes", () => ({
  __esModule: true,
  default: { getState: jest.fn(() => ({ twoWeeksTimings: [] })) },
}));

const SOUND: PrayerSoundKey = "athan2";
const OTHER_SOUND: PrayerSoundKey = "medinaAthan";

const store = () => useNotificationStore.getState();
const scheduler = scheduleAllNotifications as jest.Mock;
const INITIAL_SETTINGS = store().settings;

// Lets a flush reach the scheduler: it awaits the batch, then the qada lookups.
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

// The writer the rendered editor handed out on its latest render.
const editor: { update?: PrayerAlertSettings["update"] } = {};

const write = async () => {
  await act(async () => {
    await editor.update?.(NOTIFICATION_TYPE.PRAYER, NOTIFICATION_FIELD.SOUND, SOUND);
    await editor.update?.(NOTIFICATION_TYPE.PRAYER, NOTIFICATION_FIELD.SOUND, OTHER_SOUND);
    await editor.update?.(NOTIFICATION_TYPE.IQAMA, NOTIFICATION_FIELD.TIMING, 20);
  });
};

const Editor = ({ explode }: { explode: boolean }) => {
  const { update } = usePrayerAlertSettings(PRAYER_ID.FAJR);
  useEffect(() => {
    editor.update = update;
  }, [update]);
  if (explode) throw new Error("editor crashed");
  return null;
};

// The sheet: its session lives in the screen, its editor in the body.
const Sheet = ({ open, explode = false }: { open: boolean; explode?: boolean }) => {
  useNotificationEditSession(open);
  return <Editor explode={explode} />;
};

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError = () => ({ failed: true });

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type View = Awaited<ReturnType<typeof render>>;

// The preset's AppState mock reports no state, which reads as not in front.
const CURRENT_STATE = Object.getOwnPropertyDescriptor(AppState, "currentState");
let appStateListeners: ((state: AppStateStatus) => void)[] = [];
const moveApp = (state: AppStateStatus) =>
  act(() => appStateListeners.forEach((listener) => listener(state)));

const openSheet = () =>
  render(
    <Boundary>
      <Sheet open />
    </Boundary>
  );

beforeEach(() => {
  mockFocused = true;
  appStateListeners = [];
  scheduler.mockClear();
  useNotificationStore.setState({
    settings: { ...INITIAL_SETTINGS, overrides: {} },
    pendingReschedule: false,
    batchDepth: 0,
  });
  Object.defineProperty(AppState, "currentState", {
    value: APP_STATE.ACTIVE,
    configurable: true,
  });
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
    appStateListeners.push(handler);
    return {
      remove: () => {
        appStateListeners = appStateListeners.filter((listener) => listener !== handler);
      },
    };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  if (CURRENT_STATE) Object.defineProperty(AppState, "currentState", CURRENT_STATE);
});

// Every way out of the sheet; each pays the session's writes exactly once.
const EXITS: { name: string; leave: (view: View) => Promise<void> }[] = [
  {
    name: "the sheet closes",
    leave: (view) =>
      view.rerender(
        <Boundary>
          <Sheet open={false} />
        </Boundary>
      ),
  },
  { name: "the sheet unmounts", leave: (view) => view.unmount() },
  {
    name: "a child of the sheet throws",
    leave: async (view) => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      await view.rerender(
        <Boundary>
          <Sheet open explode />
        </Boundary>
      );
    },
  },
  {
    name: "a link navigates away from the screen",
    leave: (view) => {
      mockFocused = false;
      return view.rerender(
        <Boundary>
          <Sheet open />
        </Boundary>
      );
    },
  },
  { name: "the app leaves the foreground", leave: () => moveApp(APP_STATE.BACKGROUND) },
];

describe("useNotificationEditSession", () => {
  it("defers every write while the session is open", async () => {
    await openSheet();

    await write();
    await settle();

    expect(scheduler).not.toHaveBeenCalled();
    expect(store().pendingReschedule).toBe(true);
  });

  it.each(EXITS)("reschedules once when $name", async ({ leave }) => {
    const view = await openSheet();
    await write();

    await leave(view);
    await settle();

    expect(scheduler).toHaveBeenCalledTimes(1);
    expect(store().batchDepth).toBe(0);
    expect(store().pendingReschedule).toBe(false);
  });

  it("reschedules nothing for a session with no writes", async () => {
    const view = await openSheet();

    await view.unmount();
    await settle();

    expect(scheduler).not.toHaveBeenCalled();
    expect(store().batchDepth).toBe(0);
  });

  it("opens a fresh session on return, and each pays once", async () => {
    const view = await openSheet();
    await write();
    mockFocused = false;
    await view.rerender(
      <Boundary>
        <Sheet open />
      </Boundary>
    );
    await settle();

    mockFocused = true;
    await view.rerender(
      <Boundary>
        <Sheet open />
      </Boundary>
    );
    await act(() => editor.update?.(NOTIFICATION_TYPE.PRE_ATHAN, NOTIFICATION_FIELD.ENABLED, true));
    await settle();
    expect(scheduler).toHaveBeenCalledTimes(1);

    await view.unmount();
    await settle();
    expect(scheduler).toHaveBeenCalledTimes(2);
  });

  it("holds nothing while the sheet is closed", async () => {
    await render(<Sheet open={false} />);

    await act(() => editor.update?.(NOTIFICATION_TYPE.PRAYER, NOTIFICATION_FIELD.SOUND, SOUND));
    await settle();

    expect(store().batchDepth).toBe(0);
    expect(scheduler).toHaveBeenCalledTimes(1);
  });
});
