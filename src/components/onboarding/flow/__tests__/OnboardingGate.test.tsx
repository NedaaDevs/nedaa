import { useEffect } from "react";
import { Pressable, Text } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";

import { OnboardingGate } from "@/components/onboarding/flow/OnboardingGate";
import {
  LANDING_MS,
  ONBOARDING_PART,
  ONBOARDING_PATH,
  type OnboardingPath,
} from "@/constants/Onboarding";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useScreenLive } from "@/hooks/useScreenLive";
import { UPGRADE_PATH_WHATS_NEW_IDS } from "@/constants/UpgradePath";
import { useAppStore } from "@/stores/app";
import { renderWithTheme } from "@/test-helpers/theme";

type MockShared = { get: () => unknown };
/** Every shared value the gate made, in the order it made them. */
const mockMade: MockShared[] = [];
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("@/test-helpers/reanimatedMock");
  return {
    __esModule: true,
    ...actual,
    useSharedValue: (initial: unknown) => {
      const value = actual.useSharedValue(initial);
      if (!mockMade.includes(value)) mockMade.push(value);
      return value;
    },
  };
});
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: jest.fn(() => false) }));
jest.mock("expo-router", () => ({ useIsFocused: () => true }));

const MOCK_FLOW_ID = "flow";
const APP_ID = "app";
/** What the stub flow last rendered with. */
const mockFlow: { mounts: number; leaving?: boolean; path?: OnboardingPath } = { mounts: 0 };
jest.mock("@/components/onboarding/flow/OnboardingFlow", () => {
  const { createElement: h, useEffect } = jest.requireActual("react");
  const { Text: RNText } = jest.requireActual("react-native");
  const OnboardingFlowStub = ({
    leaving = false,
    path,
  }: {
    leaving?: boolean;
    path: OnboardingPath;
  }) => {
    useEffect(() => {
      mockFlow.mounts += 1;
    }, []);
    useEffect(() => {
      mockFlow.leaving = leaving;
      mockFlow.path = path;
    });
    return h(RNText, { testID: MOCK_FLOW_ID }, MOCK_FLOW_ID);
  };
  return { OnboardingFlow: OnboardingFlowStub };
});

const appPress = jest.fn();
const Gate = ({ show, path }: { show?: boolean; path?: OnboardingPath | null }) => (
  <OnboardingGate path={path !== undefined ? path : show ? ONBOARDING_PATH.FIRST_RUN : null}>
    <Pressable testID={APP_ID} accessibilityRole="button" onPress={appPress}>
      <Text>{APP_ID}</Text>
    </Pressable>
  </OnboardingGate>
);
const find = (id: string) => screen.queryByTestId(id, { includeHiddenElements: true });
const flowLayer = () =>
  screen.getByTestId(ONBOARDING_PART.LANDING_FLOW, { includeHiddenElements: true });
/** The gate makes the app's opacity first, then the flow's. */
const shared = () => {
  const [app, flow] = mockMade;
  return { app: app.get(), flow: flow.get() };
};

beforeEach(() => {
  jest.useFakeTimers();
  mockFlow.mounts = 0;
  mockFlow.leaving = undefined;
  mockFlow.path = undefined;
  mockMade.length = 0;
  appPress.mockClear();
  useAppStore.setState({ upgradeShownThisLaunch: false, dismissedFeatureCards: [] });
  jest.mocked(useReducedMotion).mockReturnValue(false);
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("shows only the flow during the first run", async () => {
  await renderWithTheme(<Gate show />);

  expect(find(MOCK_FLOW_ID)).toBeTruthy();
  expect(find(APP_ID)).toBeNull();
});

it("shows only the app after the first run", async () => {
  await renderWithTheme(<Gate show={false} />);

  expect(find(APP_ID)).toBeTruthy();
  expect(find(MOCK_FLOW_ID)).toBeNull();
});

it("crossfades into the app on the same flow, then lets it go after the landing", async () => {
  const view = await renderWithTheme(<Gate show />);

  await view.rerender(<Gate show={false} />);
  expect(find(APP_ID)).toBeTruthy();
  expect(find(MOCK_FLOW_ID)).toBeTruthy();
  expect(mockFlow.leaving).toBe(true);
  expect(mockFlow.mounts).toBe(1);
  // The leaving layer is hidden from readers.
  expect(screen.queryByTestId(MOCK_FLOW_ID)).toBeNull();

  await act(() => jest.advanceTimersByTimeAsync(LANDING_MS - 1));
  expect(find(MOCK_FLOW_ID)).toBeTruthy();

  await act(() => jest.advanceTimersByTimeAsync(1));
  expect(find(MOCK_FLOW_ID)).toBeNull();
  expect(find(APP_ID)).toBeTruthy();
});

it("swaps at once under Reduce Motion", async () => {
  jest.mocked(useReducedMotion).mockReturnValue(true);
  const view = await renderWithTheme(<Gate show />);

  await view.rerender(<Gate show={false} />);

  expect(find(MOCK_FLOW_ID)).toBeNull();
  expect(find(APP_ID)).toBeTruthy();
});

it("takes no touch on the app until the landing ends", async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const view = await renderWithTheme(<Gate show />);
  await view.rerender(<Gate show={false} />);

  await user.press(screen.getByTestId(APP_ID));
  expect(appPress).not.toHaveBeenCalled();

  await act(() => jest.advanceTimersByTimeAsync(LANDING_MS));
  await user.press(screen.getByTestId(APP_ID));
  expect(appPress).toHaveBeenCalledTimes(1);
});

it("clears its landing timer when it unmounts mid-landing", async () => {
  const set = jest.spyOn(global, "setTimeout");
  const clear = jest.spyOn(global, "clearTimeout");
  const view = await renderWithTheme(<Gate show />);
  await view.rerender(<Gate show={false} />);
  const landing = set.mock.calls.findIndex(([, ms]) => ms === LANDING_MS);
  const timer = set.mock.results[landing]?.value;
  expect(timer).toBeDefined();

  await view.unmount();

  expect(clear).toHaveBeenCalledWith(timer);
});

it("shows the flow fully, and afresh, when the first run starts again mid-landing", async () => {
  const view = await renderWithTheme(<Gate show />);
  await view.rerender(<Gate show={false} />);
  await act(() => jest.advanceTimersByTimeAsync(LANDING_MS / 2));

  await view.rerender(<Gate show />);
  await act(() => jest.advanceTimersByTimeAsync(LANDING_MS));

  expect(flowLayer()).toHaveStyle({ opacity: 1 });
  expect(screen.queryByTestId(MOCK_FLOW_ID)).toBeTruthy();
  expect(mockFlow.leaving).toBe(false);
  expect(mockFlow.mounts).toBe(2);
  expect(find(APP_ID)).toBeNull();
});

it("readies a later landing to start from the flow when the first run starts again", async () => {
  const view = await renderWithTheme(<Gate show />);
  await view.rerender(<Gate show={false} />);
  await act(() => jest.advanceTimersByTimeAsync(LANDING_MS));
  expect(shared()).toEqual({ app: 1, flow: 0 });

  await view.rerender(<Gate show />);

  expect(shared()).toEqual({ app: 0, flow: 1 });
});

it("marks the launch as shown when the upgrade path opens", async () => {
  const view = await renderWithTheme(<Gate path={null} />);
  expect(useAppStore.getState().upgradeShownThisLaunch).toBe(false);

  await view.rerender(<Gate path={ONBOARDING_PATH.UPGRADE} />);

  expect(useAppStore.getState().upgradeShownThisLaunch).toBe(true);
});

it("leaves the launch unmarked on a first run", async () => {
  await renderWithTheme(<Gate show />);

  expect(useAppStore.getState().upgradeShownThisLaunch).toBe(false);
  expect(useAppStore.getState().dismissedFeatureCards).toEqual([]);
});

it("marks the What's New entries the path covers as seen when it opens", async () => {
  await renderWithTheme(<Gate path={ONBOARDING_PATH.UPGRADE} />);

  expect(useAppStore.getState().dismissedFeatureCards).toEqual(UPGRADE_PATH_WHATS_NEW_IDS);
});

// An alarm found after the first frame navigates the app's stack.
it("keeps the app mounted on the upgrade path", async () => {
  await renderWithTheme(<Gate path={ONBOARDING_PATH.UPGRADE} />);

  expect(find(APP_ID)).toBeTruthy();
});

it("draws the flow for the upgrade path over an app it hides and blocks", async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await renderWithTheme(<Gate path={ONBOARDING_PATH.UPGRADE} />);

  expect(screen.queryByTestId(MOCK_FLOW_ID)).toBeTruthy();
  expect(mockFlow.path).toBe(ONBOARDING_PATH.UPGRADE);
  expect(screen.queryByTestId(APP_ID)).toBeNull();
  await user.press(screen.getByTestId(APP_ID, { includeHiddenElements: true }));
  expect(appPress).not.toHaveBeenCalled();
});

it("hands a first run its path", async () => {
  await renderWithTheme(<Gate show />);

  expect(mockFlow.path).toBe(ONBOARDING_PATH.FIRST_RUN);
});

// An alarm screen or a tap closes the path while the app runs.
it("lifts the upgrade overlay when the path closes mid-launch", async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const view = await renderWithTheme(<Gate path={ONBOARDING_PATH.UPGRADE} />);

  await view.rerender(<Gate path={null} />);
  expect(mockFlow.leaving).toBe(true);
  expect(mockFlow.path).toBe(ONBOARDING_PATH.UPGRADE);
  await act(() => jest.advanceTimersByTimeAsync(LANDING_MS));

  expect(find(MOCK_FLOW_ID)).toBeNull();
  expect(mockFlow.mounts).toBe(1);
  expect(screen.queryByTestId(APP_ID)).toBeTruthy();
  await user.press(screen.getByTestId(APP_ID));
  expect(appPress).toHaveBeenCalledTimes(1);
});

// Two skies would run at once: the app's under the flow's.
it("holds the app's live work under the upgrade path, and resumes it after", async () => {
  const seen: boolean[] = [];
  const Live = () => {
    seen.push(useScreenLive());
    return null;
  };
  const view = await renderWithTheme(
    <OnboardingGate path={ONBOARDING_PATH.UPGRADE}>
      <Live />
    </OnboardingGate>
  );
  expect(seen.at(-1)).toBe(false);

  await view.rerender(
    <OnboardingGate path={null}>
      <Live />
    </OnboardingGate>
  );

  expect(seen.at(-1)).toBe(true);
});

it("keeps one app across the upgrade path and after it", async () => {
  const mounts = jest.fn();
  const App = () => {
    useEffect(mounts, []);
    return null;
  };
  const view = await renderWithTheme(
    <OnboardingGate path={ONBOARDING_PATH.UPGRADE}>
      <App />
    </OnboardingGate>
  );

  await view.rerender(
    <OnboardingGate path={null}>
      <App />
    </OnboardingGate>
  );
  await act(() => jest.advanceTimersByTimeAsync(LANDING_MS));

  expect(mounts).toHaveBeenCalledTimes(1);
});
