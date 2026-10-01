import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Appearance, AppState, Text, type ColorSchemeName } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { captureRef, releaseCapture } from "react-native-view-shot";

import { DISSOLVE_PART, ThemeTransitionProvider } from "@/components/ui/theme-transition";
import { APP_STATE } from "@/constants/AppState";
import { NATIVE_SCHEME, type NativeScheme } from "@/constants/Appearance";
import { PhaseContext } from "@/contexts/PhaseContext";
import { SchemeContext } from "@/contexts/SchemeContext";
import { AppMode } from "@/enums/app";
import { useAppIsDark } from "@/hooks/useAppIsDark";
import { useChooseMode } from "@/hooks/useChooseMode";
import { useRootAppearance } from "@/hooks/useRootAppearance";
import { useAppStore } from "@/stores/app";

const SNAPSHOT_URI = "file:///tmp/snapshot.jpg";
/** How long the phone takes to report a released pin; native events are late. */
const PHONE_REPORT_MS = 30;
/** Long enough for a second flip, had there been one, to start its dissolve. */
const SETTLE_MS = 300;

jest.mock("react-native-view-shot", () => ({
  captureRef: jest.fn(),
  releaseCapture: jest.fn(),
}));
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => false }));

/** The phone's own scheme, the app's pin, and the scheme React Native last reported. */
const mockPhone = {
  own: NATIVE_SCHEME.DARK as ColorSchemeName,
  pin: NATIVE_SCHEME.LIGHT as NativeScheme,
  reported: NATIVE_SCHEME.LIGHT as ColorSchemeName,
  listeners: new Set<(preferences: { colorScheme: ColorSchemeName }) => void>(),
};
const effective = () =>
  mockPhone.pin === NATIVE_SCHEME.UNSPECIFIED ? mockPhone.own : mockPhone.pin;

// React Native's hook, read from the fake phone.
jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: () =>
    jest.requireActual<typeof import("react")>("react").useSyncExternalStore(
      (onChange: () => void) => {
        const listener = () => onChange();
        mockPhone.listeners.add(listener);
        return () => mockPhone.listeners.delete(listener);
      },
      () => mockPhone.reported
    ),
}));

/** Every step the test watches, in the order it happened. */
let events: string[] = [];

let choose: (mode: AppMode) => Promise<void> = async () => {};

/** The smallest slice of the root: its appearance, and what it hands down. */
const Root = ({ children }: { children: ReactNode }) => {
  const { phase, scheme } = useRootAppearance(undefined);
  return (
    <PhaseContext value={phase}>
      <SchemeContext value={scheme}>{children}</SchemeContext>
    </PhaseContext>
  );
};

const Probe = () => {
  const chooseMode = useChooseMode();
  const dark = useAppIsDark();
  const last = useRef<boolean | null>(null);
  useEffect(() => {
    choose = chooseMode;
  }, [chooseMode]);
  useEffect(() => {
    if (last.current !== dark) events.push(`dark:${dark}`);
    last.current = dark;
  }, [dark]);
  return <Text>{String(dark)}</Text>;
};

const snapshot = () =>
  screen.queryByTestId(DISSOLVE_PART.SNAPSHOT, { includeHiddenElements: true });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("useRootAppearance", () => {
  beforeEach(() => {
    events = [];
    Object.assign(mockPhone, {
      own: NATIVE_SCHEME.DARK,
      pin: NATIVE_SCHEME.LIGHT,
      reported: NATIVE_SCHEME.LIGHT,
    });
    mockPhone.listeners.clear();
    Object.defineProperty(AppState, "currentState", {
      value: APP_STATE.ACTIVE,
      configurable: true,
    });
    jest
      .mocked(captureRef)
      .mockReset()
      .mockImplementation(async () => {
        events.push("capture");
        return SNAPSHOT_URI;
      });
    jest.mocked(releaseCapture).mockClear();
    jest.spyOn(Appearance, "getColorScheme").mockImplementation(() => mockPhone.reported);
    jest.spyOn(Appearance, "addChangeListener").mockImplementation((listener) => {
      mockPhone.listeners.add(listener);
      return { remove: () => mockPhone.listeners.delete(listener) };
    });
    // A fixed pin reads back at once; a released one waits for the phone.
    jest.spyOn(Appearance, "setColorScheme").mockImplementation((next) => {
      const before = effective();
      mockPhone.pin = next as NativeScheme;
      if (next !== NATIVE_SCHEME.UNSPECIFIED) mockPhone.reported = mockPhone.pin;
      if (effective() === before && mockPhone.reported === before) return;
      setTimeout(() => {
        mockPhone.reported = effective();
        mockPhone.listeners.forEach((listener) => listener({ colorScheme: mockPhone.reported }));
      }, PHONE_REPORT_MS);
    });
    const timing = Animated.timing;
    jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
      events.push("fade");
      return timing(value, config);
    });
    useAppStore.setState({ mode: AppMode.LIGHT });
  });

  afterEach(() => jest.restoreAllMocks());

  // Light pins the phone light; System hands it back to a phone set dark.
  it("shows the phone's scheme before the fade when a tap releases the pin", async () => {
    await render(
      <ThemeTransitionProvider>
        <Root>
          <Probe />
        </Root>
      </ThemeTransitionProvider>
    );
    expect(events).toEqual(["dark:false"]);

    let done: Promise<void> = Promise.resolve();
    await act(async () => {
      done = choose(AppMode.SYSTEM);
      await wait(0);
    });
    await waitFor(() => expect(snapshot()).not.toBeNull());
    await act(async () => {
      fireEvent(snapshot()!, "load");
      await wait(0);
    });
    await waitFor(() => expect(snapshot()).toBeNull(), { timeout: SETTLE_MS * 4 });
    await act(() => done);
    await act(() => wait(SETTLE_MS));

    expect(events).toEqual(["dark:false", "capture", "dark:true", "fade"]);
    expect(captureRef).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().mode).toBe(AppMode.SYSTEM);
  });
});
