// First, before expo-router's testing library: that library re-mocks Reanimated
// as it loads, and the host must bind to the mock below, not to its empty one.
import { ToastHost, TOAST_HOST_PART, TOAST_HOST_GESTURE } from "@/components/ToastHost";
import { cancelAnimation, ReduceMotion, withSpring, withTiming } from "react-native-reanimated";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { act, userEvent } from "@testing-library/react-native";
import { State } from "react-native-gesture-handler";
import { fireGestureHandler, getByGestureTestId } from "react-native-gesture-handler/jest-utils";
import { renderRouter, screen } from "expo-router/testing-library";

import { MessageToast } from "@/components/feedback/MessageToast";
import { TOAST_DWELL_MS, TOAST_GAP, TOAST_KIND, TOAST_MOTION } from "@/constants/Toast";
import { SPRING } from "@/constants/Motion";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useTabBarFrameStore } from "@/stores/tabBarFrame";
import { useToastStore } from "@/stores/toast";
import { ThemeProvider } from "@/test-helpers/theme";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { clearHaptics, firedHaptics } from "@/test-helpers/hapticMock";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const announce = jest.mocked(AccessibilityInfo.announceForAccessibilityWithOptions);
const label = (kind: string, message: string) => `${i18n.t(`a11y.toast.${kind}`)}: ${message}`;

const renderHost = (initialUrl = BACK_DESTINATION.HOME.href as string) =>
  renderRouter(
    {
      [BACK_DESTINATION.HOME.route]: () => <ToastHost />,
      [BACK_DESTINATION.SETTINGS_LOCATION.route]: () => <ToastHost />,
    },
    { initialUrl, wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider> }
  );

const bottom = () =>
  StyleSheet.flatten(screen.getByTestId(TOAST_HOST_PART.FRAME).props.style).bottom as number;

describe("ToastHost", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    mockReduced = false;
    await act(() => i18n.changeLanguage(AppLocale.EN));
    useToastStore.setState({ toast: null });
    useTabBarFrameStore.setState({ height: 0 });
    announce.mockClear();
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(false);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("shows a toast and says it, waiting its turn", async () => {
    await renderHost();
    await act(() => MessageToast.showSuccess("Link copied"));

    expect(screen.getByLabelText(label(TOAST_KIND.SUCCESS, "Link copied"))).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(label(TOAST_KIND.SUCCESS, "Link copied"), {
      queue: true,
    });
  });

  it("interrupts the screen reader for an error", async () => {
    await renderHost();
    await act(() => MessageToast.showError("Couldn't update"));

    expect(announce).toHaveBeenCalledWith(label(TOAST_KIND.ERROR, "Couldn't update"), {
      queue: false,
      priority: "high",
    });
  });

  it("leaves once its time is up and its exit has played", async () => {
    await renderHost();
    await act(() => MessageToast.showSuccess("Link copied"));

    await act(() => jest.advanceTimersByTime(TOAST_DWELL_MS[TOAST_KIND.SUCCESS]));
    await act(() => jest.advanceTimersByTime(TOAST_MOTION.exitMs));

    expect(screen.queryByTestId(TOAST_HOST_PART.FRAME)).toBeNull();
  });

  it("stays twice as long while a screen reader runs", async () => {
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true);
    await renderHost();
    await act(async () => {});
    await act(() => MessageToast.showSuccess("Link copied"));

    await act(() =>
      jest.advanceTimersByTime(TOAST_DWELL_MS[TOAST_KIND.SUCCESS] + TOAST_MOTION.exitMs)
    );

    expect(screen.getByTestId(TOAST_HOST_PART.FRAME)).toBeTruthy();
  });

  it("puts a new toast in place of the old", async () => {
    await renderHost();
    await act(() => MessageToast.showProgress("Refreshing widgets…"));
    await act(() => MessageToast.showSuccess("Widgets updated"));

    expect(screen.queryByText("Refreshing widgets…")).toBeNull();
    expect(screen.getByText("Widgets updated")).toBeTruthy();
  });

  it("leaves and redoes the operation when its action is pressed", async () => {
    const onPress = jest.fn();
    await renderHost();
    await act(() =>
      MessageToast.showError("Couldn't update", { action: { label: "Retry", onPress } })
    );

    await userEvent
      .setup({ advanceTimers: jest.advanceTimersByTime })
      .press(screen.getByRole("button", { name: "Retry" }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toast).toBeNull();
  });

  it("acts once, however fast its action is pressed again during the exit", async () => {
    const onPress = jest.fn();
    await renderHost();
    await act(() =>
      MessageToast.showError("Couldn't update", { action: { label: "Retry", onPress } })
    );
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const retry = screen.getByRole("button", { name: "Retry" });

    await user.press(retry);
    await user.press(retry);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("stops the progress icon turning when the outcome takes its place", async () => {
    await renderHost();
    await act(() => MessageToast.showProgress("Refreshing widgets…"));
    jest.mocked(cancelAnimation).mockClear();

    await act(() => MessageToast.showSuccess("Widgets updated"));

    expect(cancelAnimation).toHaveBeenCalled();
  });

  // The host fades by itself under Reduce Motion; Reanimated's rule would snap.
  it("plays its own Reduce Motion fade", async () => {
    await renderHost();
    jest.mocked(withTiming).mockClear();
    await act(() => MessageToast.showSuccess("Link copied"));

    expect(jest.mocked(withTiming).mock.calls[0][1]).toMatchObject({
      reduceMotion: ReduceMotion.Never,
    });
  });

  it("rises on the settle spring while it fades in", async () => {
    await renderHost();
    jest.mocked(withSpring).mockClear();
    jest.mocked(withTiming).mockClear();
    await act(() => MessageToast.showSuccess("Link copied"));

    expect(withSpring).toHaveBeenCalledWith(0, {
      ...SPRING.SETTLE,
      reduceMotion: ReduceMotion.Never,
    });
    expect(withTiming).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ duration: TOAST_MOTION.enterMs })
    );
  });

  it("only fades in under Reduce Motion", async () => {
    mockReduced = true;
    await renderHost();
    jest.mocked(withSpring).mockClear();
    jest.mocked(withTiming).mockClear();
    await act(() => MessageToast.showSuccess("Link copied"));

    expect(withSpring).not.toHaveBeenCalled();
    expect(withTiming).toHaveBeenCalledTimes(1);
    expect(withTiming).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ duration: TOAST_MOTION.reducedMs })
    );
  });

  // A haptic marks an outcome; a plain statement or work under way stays quiet.
  it.each([
    [TOAST_KIND.SUCCESS, [HAPTIC_FEEDBACK.SUCCESS]],
    [TOAST_KIND.WARNING, [HAPTIC_FEEDBACK.WARNING]],
    [TOAST_KIND.ERROR, [HAPTIC_FEEDBACK.ERROR]],
    [TOAST_KIND.INFO, []],
    [TOAST_KIND.PROGRESS, []],
  ] as const)("plays the %s toast's haptic: %j", async (kind, haptics) => {
    await renderHost();
    clearHaptics();
    await act(() => useToastStore.getState().show({ kind, message: "Saved" }));

    expect(firedHaptics()).toEqual(haptics);
  });

  it("keeps the haptic under Reduce Motion", async () => {
    mockReduced = true;
    await renderHost();
    clearHaptics();
    await act(() => MessageToast.showError("Couldn't save"));

    expect(firedHaptics()).toEqual([HAPTIC_FEEDBACK.ERROR]);
  });

  // Reduce Motion turning on mid-toast replays its motion, never its arrival.
  it("plays the haptic and the announcement once per toast", async () => {
    await renderHost();
    clearHaptics();
    await act(() => MessageToast.showError("Couldn't save"));

    mockReduced = true;
    await act(() => useTabBarFrameStore.setState({ height: 80 }));

    expect(firedHaptics()).toEqual([HAPTIC_FEEDBACK.ERROR]);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it("snaps back on the snap spring after a short drag", async () => {
    await renderHost();
    await act(() => MessageToast.showSuccess("Link copied"));
    jest.mocked(withSpring).mockClear();

    await act(() =>
      fireGestureHandler(getByGestureTestId(TOAST_HOST_GESTURE.SWIPE), [
        { state: State.BEGAN, translationY: 0 },
        { state: State.ACTIVE, translationY: 10 },
        { state: State.END, translationY: 10 },
      ])
    );

    expect(withSpring).toHaveBeenCalledWith(0, {
      ...SPRING.SNAP,
      reduceMotion: ReduceMotion.Never,
    });
  });

  it("sits above the tab bar on a tab", async () => {
    useTabBarFrameStore.setState({ height: 92 });
    await renderHost();
    await act(() => MessageToast.showSuccess("Link copied"));

    expect(bottom()).toBe(92 + TOAST_GAP);
  });

  it("ignores the tab bar's last height on a stack screen", async () => {
    useTabBarFrameStore.setState({ height: 92 });
    await renderHost(BACK_DESTINATION.SETTINGS_LOCATION.href as string);
    await act(() => MessageToast.showSuccess("Link copied"));

    expect(bottom()).toBe(TOAST_GAP);
  });
});
