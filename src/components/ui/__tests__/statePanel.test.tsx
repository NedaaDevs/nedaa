import { AccessibilityInfo, Platform, StyleSheet } from "react-native";
import { screen, userEvent } from "@testing-library/react-native";

import { CALLOUT_PART, CALLOUT_TONE, Callout } from "@/components/ui/callout";
import { STATE_PANEL_ICON_ID, STATE_PANEL_ROOT_ID, StatePanel } from "@/components/ui/state-panel";
import { Theme } from "tamagui";

import { NEDAA_DARK, NEDAA_LIGHT } from "@/constants/Palette";
import { STATE_PANEL_KIND, STATE_PANEL_VARIANT } from "@/constants/StatePanel";
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

  // A wait has nothing to act on; the message alone is announced.
  it("offers no action while something loads", async () => {
    await renderWithTheme(
      <StatePanel kind={STATE_PANEL_KIND.LOADING} title="Loading" body="Getting things ready." />
    );

    expect(
      screen.getByLabelText("Loading. Getting things ready.").props.accessibilityLiveRegion
    ).toBe("polite");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each(Object.values(STATE_PANEL_KIND))("marks the %s kind with its own icon", async (kind) => {
    await renderWithTheme(<StatePanel kind={kind} title="Title" body="Body." />);

    expect(
      screen.getByTestId(STATE_PANEL_ICON_ID[kind], { includeHiddenElements: true })
    ).toBeTruthy();
  });

  // A card sets the state off by its fill; the flat variant sits on a sheet's own surface.
  it.each([
    [STATE_PANEL_VARIANT.CARD, true],
    [STATE_PANEL_VARIANT.FLAT, false],
  ])("draws a %s variant with a filled frame: %s", async (variant, framed) => {
    await renderWithTheme(<StatePanel variant={variant} title="Title" body="Body." />);

    const root = screen.getByTestId(STATE_PANEL_ROOT_ID);
    expect(root).not.toHaveStyle({ borderTopWidth: 1 });
    if (framed) expect(root).toHaveStyle({ backgroundColor: NEDAA_LIGHT.surfaceGlass.hex });
    else expect(root).not.toHaveStyle({ backgroundColor: NEDAA_LIGHT.surfaceGlass.hex });
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

describe("Callout tones", () => {
  it("states a fact with no action, offering nothing to press", async () => {
    await renderWithTheme(<Callout body="Showing Makkah's times." />);

    expect(screen.getByLabelText("Showing Makkah's times.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("warns by default: the warn edge and the warning sign", async () => {
    await renderWithTheme(<Callout body="Showing Makkah's times." />);

    expect(screen.getByTestId(CALLOUT_PART.FRAME)).toHaveStyle({
      borderTopWidth: 1,
      borderTopColor: NEDAA_LIGHT.warn.hex,
    });
    expect(
      screen.getByTestId(CALLOUT_PART.ICON_WARN, { includeHiddenElements: true })
    ).toBeTruthy();
  });

  // A tint, never a line, carries a calm tone: light blue, or navy in dark.
  it.each([
    ["light", NEDAA_LIGHT, false],
    ["dark", NEDAA_DARK, true],
  ] as const)(
    "informs on the tile tint in %s, with no edge and the info sign in the ink",
    async (_theme, palette, dark) => {
      const callout = <Callout tone={CALLOUT_TONE.INFO} body="Found from a recent reading." />;
      await renderWithTheme(dark ? <Theme name="dark">{callout}</Theme> : callout);

      const frame = screen.getByTestId(CALLOUT_PART.FRAME);
      expect(frame).toHaveStyle({ backgroundColor: palette.tile.hex });
      expect(frame).not.toHaveStyle({ borderTopWidth: 1 });
      const sign = screen.getByTestId(CALLOUT_PART.ICON_INFO, { includeHiddenElements: true });
      const [glyph] = sign.queryAll((node) => node.type === "RNSVGSvgView");
      expect(glyph).toHaveProp("stroke", palette.fg.hex);
    }
  );
});

describe("Callout's place tone", () => {
  const fontOf = (text: string) =>
    String(StyleSheet.flatten(screen.getByText(text).props.style).fontFamily);

  it("names a found place on its own strong line, over its detail, by a pin", async () => {
    await renderWithTheme(
      <Callout tone={CALLOUT_TONE.PLACE} title="Nearest city: Makkah" body="2 km away" />
    );

    expect(screen.getByLabelText("Nearest city: Makkah, 2 km away")).toBeTruthy();
    expect(fontOf("Nearest city: Makkah")).not.toBe(fontOf("2 km away"));
    expect(screen.getByTestId(CALLOUT_PART.FRAME)).toHaveStyle({
      backgroundColor: NEDAA_LIGHT.tile.hex,
    });
    expect(
      screen.getByTestId(CALLOUT_PART.ICON_PLACE, { includeHiddenElements: true })
    ).toBeTruthy();
  });

  // A note whose host says it at a settled moment is no live region.
  it("is read aloud as it changes unless its host says it", async () => {
    await renderWithTheme(
      <>
        <Callout body="Read as it changes." />
        <Callout body="Said by its host." live={false} />
      </>
    );

    expect(screen.getByLabelText("Read as it changes.").props.accessibilityLiveRegion).toBe(
      "polite"
    );
    expect(screen.getByLabelText("Said by its host.").props.accessibilityLiveRegion).toBe("none");
  });
});
