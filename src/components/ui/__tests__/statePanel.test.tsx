import { AccessibilityInfo, Platform } from "react-native";
import { screen, userEvent } from "@testing-library/react-native";

import { CALLOUT_PART, Callout } from "@/components/ui/callout";
import { StatePanel } from "@/components/ui/state-panel";
import { PlatformType } from "@/enums/app";
import { renderWithTheme } from "@/test-helpers/theme";

const PLATFORM = Platform.OS;

describe("StatePanel", () => {
  const renderPanel = async (onAction = jest.fn()) => {
    await renderWithTheme(
      <StatePanel
        title="Couldn't load the times"
        body="Check your connection."
        action={{ label: "Retry", onPress: onAction }}
      />
    );
    return onAction;
  };

  // A state change is announced, and its message reads as one element.
  it("announces its message politely, as one element", async () => {
    await renderPanel();

    const message = screen.getByLabelText("Couldn't load the times. Check your connection.");
    expect(message.props.accessibilityLiveRegion).toBe("polite");
  });

  it("keeps its action reachable on its own, and runs it", async () => {
    const onAction = await renderPanel();

    await userEvent.press(screen.getByRole("button", { name: "Retry" }));

    expect(onAction).toHaveBeenCalled();
  });

  describe("speaking its message", () => {
    afterEach(() => {
      Platform.OS = PLATFORM;
      jest.mocked(AccessibilityInfo.announceForAccessibility).mockClear();
    });

    // Android speaks the live region; iOS has none, so the panel says it.
    it("says what failed on iOS as it appears", async () => {
      Platform.OS = PlatformType.IOS;
      await renderPanel();

      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
        "Couldn't load the times. Check your connection."
      );
    });

    it("leaves Android to its live region", async () => {
      Platform.OS = PlatformType.ANDROID;
      await renderPanel();

      expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
    });
  });
});

describe("Callout", () => {
  it("reads its message and offers its action", async () => {
    const onAction = jest.fn();
    await renderWithTheme(
      <Callout
        body="Showing Makkah's times."
        action={{ label: "Set location", hint: "Opens location settings", onPress: onAction }}
      />
    );

    expect(screen.getByLabelText("Showing Makkah's times.").props.accessibilityLiveRegion).toBe(
      "polite"
    );
    const button = screen.getByRole("button", { name: "Set location" });
    expect(button.props.accessibilityHint).toBe("Opens location settings");

    await userEvent.press(button);
    expect(onAction).toHaveBeenCalled();
  });

  // An underline crosses Arabic dots and descenders; a chevron marks the action.
  it.each([false, true])(
    "marks its action with a chevron, not an underline (rtl: %s)",
    async (isRTL) => {
      await renderWithTheme(
        <Callout
          body="Showing Makkah's times."
          action={{ label: "Set location", onPress: jest.fn() }}
        />,
        { isRTL }
      );

      expect(screen.getByText("Set location", { includeHiddenElements: true })).not.toHaveStyle({
        textDecorationLine: "underline",
      });
      expect(
        screen.getByTestId(isRTL ? CALLOUT_PART.CHEVRON_LEFT : CALLOUT_PART.CHEVRON_RIGHT, {
          includeHiddenElements: true,
        })
      ).toBeTruthy();
    }
  );
});
