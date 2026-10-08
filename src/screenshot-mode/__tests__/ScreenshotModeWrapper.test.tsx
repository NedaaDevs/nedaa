import { Text } from "react-native";
import { act, render, screen } from "@testing-library/react-native";

import { E2E_ID, screenshotReadyId } from "@/constants/E2E";
import { ScreenshotModeWrapper } from "@/screenshot-mode/ScreenshotModeWrapper";
import { useAppStore } from "@/stores/app";
import { useScreenshotStore } from "@/stores/screenshotStore";

const STATUS_BAR = 52;

jest.mock("@/screenshot-mode/flag", () => ({ IS_SCREENSHOT_MODE: true }));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  initialWindowMetrics: {
    frame: { x: 0, y: 0, width: 400, height: 900 },
    insets: { top: 52, left: 0, right: 0, bottom: 24 },
  },
}));

const settle = () =>
  act(() =>
    useScreenshotStore.getState().setShot({
      screen: "settings",
      locale: "ar",
      seed: "default",
      payload: {},
    })
  );

const hidden = { includeHiddenElements: true } as const;

describe("ScreenshotModeWrapper", () => {
  afterEach(() => {
    useScreenshotStore.getState().reset();
    useAppStore.setState({ showLoadingOverlay: false });
  });

  it("shows no readiness marker before a shot settles", async () => {
    await render(
      <ScreenshotModeWrapper>
        <Text>app</Text>
      </ScreenshotModeWrapper>
    );

    expect(screen.queryByTestId(E2E_ID.SCREENSHOT_READY, hidden)).toBeNull();
  });

  // Fabric flattens an empty View away, so Maestro on Android never sees it.
  it("marks the settled shot with a view that survives flattening", async () => {
    await render(
      <ScreenshotModeWrapper>
        <Text>app</Text>
      </ScreenshotModeWrapper>
    );

    await settle();

    expect(screen.getByTestId(E2E_ID.SCREENSHOT_READY, hidden)).toBeTruthy();
    const marker = screen.getByTestId(screenshotReadyId("settings", "ar"), hidden);
    expect(marker.props.collapsable).toBe(false);
  });

  // A capture over the loading card would pass for a settled screen.
  it("holds the marker while the app shows its loading overlay", async () => {
    useAppStore.setState({ showLoadingOverlay: true });
    await render(
      <ScreenshotModeWrapper>
        <Text>app</Text>
      </ScreenshotModeWrapper>
    );
    await settle();

    expect(screen.queryByTestId(E2E_ID.SCREENSHOT_READY, hidden)).toBeNull();

    await act(() => useAppStore.setState({ showLoadingOverlay: false }));

    expect(screen.getByTestId(E2E_ID.SCREENSHOT_READY, hidden)).toBeTruthy();
  });

  // The visual check crops to this frame, so the system status bar never counts.
  it("frames the app below the status bar", async () => {
    await render(
      <ScreenshotModeWrapper>
        <Text>app</Text>
      </ScreenshotModeWrapper>
    );

    const frame = screen.getByTestId(E2E_ID.SCREENSHOT_FRAME, hidden);
    expect(frame.props.style).toMatchObject({ top: STATUS_BAR, bottom: 0, left: 0, right: 0 });
  });
});
