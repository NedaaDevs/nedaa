import { Pressable, Text } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";

import { OnboardingGate } from "@/components/onboarding/flow/OnboardingGate";
import { LANDING_MS, ONBOARDING_PART } from "@/constants/Onboarding";
import { useReducedMotion } from "@/hooks/useReducedMotion";
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

const MOCK_FLOW_ID = "flow";
const APP_ID = "app";
/** What the stub flow last rendered with. */
const mockFlow: { mounts: number; leaving?: boolean } = { mounts: 0 };
jest.mock("@/components/onboarding/flow/OnboardingFlow", () => {
  const { createElement: h, useEffect } = jest.requireActual("react");
  const { Text: RNText } = jest.requireActual("react-native");
  const OnboardingFlowStub = ({ leaving = false }: { leaving?: boolean }) => {
    useEffect(() => {
      mockFlow.mounts += 1;
    }, []);
    useEffect(() => {
      mockFlow.leaving = leaving;
    });
    return h(RNText, { testID: MOCK_FLOW_ID }, MOCK_FLOW_ID);
  };
  return { OnboardingFlow: OnboardingFlowStub };
});

const appPress = jest.fn();
const Gate = ({ show }: { show: boolean }) => (
  <OnboardingGate showOnboarding={show}>
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
  mockMade.length = 0;
  appPress.mockClear();
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
