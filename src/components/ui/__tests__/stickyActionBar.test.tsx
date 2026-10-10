import { AccessibilityInfo, Platform } from "react-native";
import { screen, userEvent } from "@testing-library/react-native";

import { STICKY_ACTION_PART, StickyActionBar } from "@/components/ui/sticky-action-bar";
import { STICKY_ACTION_STATE } from "@/constants/StickyActionBar";
import { PlatformType } from "@/enums/app";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const PLATFORM = Platform.OS;
const LABEL = "Apply changes";
const BUSY = "Applying changes…";

describe("StickyActionBar", () => {
  it("draws nothing while there is nothing to apply", async () => {
    await renderWithTheme(
      <StickyActionBar
        state={STICKY_ACTION_STATE.HIDDEN}
        label={LABEL}
        busyStatus={BUSY}
        onPress={jest.fn()}
      />
    );

    expect(screen.queryByTestId(STICKY_ACTION_PART.ROOT)).toBeNull();
  });

  it("runs its action once when pressed", async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <StickyActionBar
        state={STICKY_ACTION_STATE.READY}
        label={LABEL}
        busyStatus={BUSY}
        onPress={onPress}
      />
    );

    await userEvent.press(screen.getByRole("button", { name: LABEL }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(BUSY)).toBeNull();
  });

  // A second press during the work would start it twice.
  it("disables its action and announces the work while busy", async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <StickyActionBar
        state={STICKY_ACTION_STATE.BUSY}
        label={LABEL}
        busyStatus={BUSY}
        onPress={onPress}
      />
    );

    const button = screen.getByRole("button", { name: LABEL });
    expect(button).toBeDisabled();
    await userEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();

    const status = screen.getByTestId(STICKY_ACTION_PART.STATUS);
    expect(status.props.accessibilityLiveRegion).toBe("polite");
    expect(screen.getByText(BUSY)).toBeTruthy();
  });

  // iOS has no live regions, so each step is announced as it starts.
  describe("on iOS", () => {
    const renderBar = (busyStatus: string) => (
      <StickyActionBar
        state={STICKY_ACTION_STATE.BUSY}
        label={LABEL}
        busyStatus={busyStatus}
        onPress={jest.fn()}
      />
    );

    beforeEach(() => {
      Platform.OS = PlatformType.IOS;
      jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear();
    });
    afterEach(() => {
      Platform.OS = PLATFORM;
    });

    it("announces each step as the work moves on", async () => {
      await renderWithTheme(renderBar("Fetching prayer times…"));
      await screen.rerender(renderBar("Scheduling notifications…"));

      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenNthCalledWith(
        1,
        "Fetching prayer times…"
      );
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenNthCalledWith(
        2,
        "Scheduling notifications…"
      );
    });
  });
});
