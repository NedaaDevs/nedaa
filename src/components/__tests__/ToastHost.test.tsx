// First, before expo-router's testing library: that library re-mocks Reanimated
// as it loads, and the host must bind to the mock below, not to its empty one.
import { ToastHost, TOAST_HOST_PART } from "@/components/ToastHost";
import { cancelAnimation, ReduceMotion, withTiming } from "react-native-reanimated";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { act, userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { MessageToast } from "@/components/feedback/MessageToast";
import { TOAST_DWELL_MS, TOAST_GAP, TOAST_KIND, TOAST_MOTION } from "@/constants/Toast";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useTabBarFrameStore } from "@/stores/tabBarFrame";
import { useToastStore } from "@/stores/toast";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
// The gesture runs only on a device; here the detector renders its child.
jest.mock("react-native-gesture-handler", () => {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const name of ["runOnJS", "activeOffsetY", "failOffsetX", "onChange", "onEnd"])
    chain[name] = self;
  return {
    Gesture: { Pan: () => chain },
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  };
});

const announce = jest.mocked(AccessibilityInfo.announceForAccessibilityWithOptions);
const label = (kind: string, message: string) => `${i18n.t(`a11y.toast.${kind}`)}: ${message}`;

const renderHost = (initialUrl = "/") =>
  renderRouter(
    { "(tabs)/index": () => <ToastHost />, "settings/location": () => <ToastHost /> },
    { initialUrl, wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider> }
  );

const bottom = () =>
  StyleSheet.flatten(screen.getByTestId(TOAST_HOST_PART.FRAME).props.style).bottom as number;

describe("ToastHost", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
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

  it("sits above the tab bar on a tab", async () => {
    useTabBarFrameStore.setState({ height: 92 });
    await renderHost();
    await act(() => MessageToast.showSuccess("Link copied"));

    expect(bottom()).toBe(92 + TOAST_GAP);
  });

  it("ignores the tab bar's last height on a stack screen", async () => {
    useTabBarFrameStore.setState({ height: 92 });
    await renderHost("/settings/location");
    await act(() => MessageToast.showSuccess("Link copied"));

    expect(bottom()).toBe(TOAST_GAP);
  });
});
