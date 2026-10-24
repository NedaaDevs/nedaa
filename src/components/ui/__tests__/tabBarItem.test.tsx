import type { ReactElement } from "react";
import { House } from "lucide-react-native";
import { Platform, StyleSheet } from "react-native";
import { act, fireEvent, screen, userEvent } from "@testing-library/react-native";
import { withSpring } from "react-native-reanimated";
import { getTokenValue } from "tamagui";

import config from "../../../../tamagui.config";
import { TAB_BAR_ITEM_PART, TabBar, TabBarItem } from "@/components/ui/tab-bar-item";
import { ELEVATION } from "@/constants/Elevation";
import { SPRING } from "@/constants/Motion";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const BLUR_VIEW = "blur-view";
jest.mock("expo-blur", () => {
  const { createElement } = jest.requireActual("react");
  const { View: NativeView } = jest.requireActual("react-native");
  return {
    BlurView: (props: object) => createElement(NativeView, { testID: "blur-view", ...props }),
  };
});

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const LIGHT = config.themes.light;
const LABEL = "Today";

const renderItem = (selected: boolean, onPress = jest.fn()) =>
  renderWithTheme(<TabBarItem label={LABEL} icon={House} selected={selected} onPress={onPress} />);

const tab = () => screen.getByRole("tab", { name: LABEL });

const styleOfId = (id: string) =>
  StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style);

const scaleOf = () =>
  (styleOfId(TAB_BAR_ITEM_PART.ICON).transform as { scale: number }[] | undefined)?.[0]?.scale;

beforeEach(() => {
  mockReduced = false;
  jest.mocked(withSpring).mockClear();
});

describe("TabBarItem", () => {
  it.each([true, false])("is a tab that reports selected: %s", async (selected) => {
    await renderItem(selected);

    expect(screen.getByRole("tab", { name: LABEL, selected })).toBeOnTheScreen();
  });

  it("fires on press", async () => {
    const onPress = jest.fn();
    await renderItem(false, onPress);

    await userEvent.setup().press(tab());

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // The tab bar sits above the 44pt floor every other control holds.
  it("holds the tab touch floor", async () => {
    await renderItem(false);

    expect(tab()).toHaveStyle({ minHeight: config.tokens.size.targetTab.val });
  });

  // A tab fills the 64pt bar inside its 4pt inset.
  it("fills the bar's height inside its inset", async () => {
    await renderItem(false);

    expect(tab()).toHaveStyle({
      minHeight: getTokenValue("$16", "size") - 2 * getTokenValue("$1", "space"),
      borderTopLeftRadius: getTokenValue("$pill", "radius"),
    });
  });

  it.each([
    ["selected", true, LIGHT.accentText.val],
    ["idle", false, LIGHT.muted.val],
  ])("draws a %s label in its colour", async (_state, selected, colour) => {
    await renderItem(selected);

    expect(screen.getByText(LABEL)).toHaveStyle({ color: colour });
  });

  it("sets the label at 12", async () => {
    await renderItem(true);

    expect(screen.getByText(LABEL)).toHaveStyle({ fontSize: 12 });
  });

  describe("icon", () => {
    const select = async (rerender: (ui: ReactElement) => Promise<void>) =>
      rerender(<TabBarItem label={LABEL} icon={House} selected onPress={jest.fn()} />);

    it("rests at full size when the bar first draws", async () => {
      await renderItem(true);

      expect(scaleOf()).toBe(1);
      expect(withSpring).not.toHaveBeenCalled();
    });

    it("pops from .92 on the snap spring when its tab is chosen", async () => {
      const { rerender } = await renderItem(false);

      await select(rerender);

      expect(withSpring).toHaveBeenCalledWith(1, SPRING.SNAP);
      expect(scaleOf()).toBe(1);
    });

    it("does not scale under reduced motion", async () => {
      mockReduced = true;
      const { rerender } = await renderItem(false);

      await select(rerender);

      expect(withSpring).not.toHaveBeenCalled();
      expect(scaleOf()).toBe(1);
    });
  });
});

const TABS = ["Today", "Quran", "Athkar", "More"] as const;
const TRACK_LABEL = "Tabs";
const PAD = 4;
const TRACK_WIDTH = 362;
/** 4 tabs in a 362 track: (362 - 2 x 4 pad) / 4 = 88.5 each. */
const TAB_WIDTH = (TRACK_WIDTH - 2 * PAD) / TABS.length;

const bar = (selected: number) => (
  <TabBar accessibilityLabel={TRACK_LABEL} selectedIndex={selected} count={TABS.length}>
    {TABS.map((label, index) => (
      <TabBarItem
        key={label}
        label={label}
        icon={House}
        selected={index === selected}
        onPress={jest.fn()}
      />
    ))}
  </TabBar>
);

const renderBar = (selected = 0, { isRTL = false } = {}) =>
  renderWithTheme(bar(selected), { isRTL });

const layOut = () =>
  act(() =>
    fireEvent(screen.getByTestId(TAB_BAR_ITEM_PART.TRACK), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: TRACK_WIDTH, height: 64 } },
    })
  );

const indicator = () => styleOfId(TAB_BAR_ITEM_PART.INDICATOR);
const translateOf = () =>
  (indicator().transform as { translateX: number }[] | undefined)?.[0]?.translateX;

const originalOS = Platform.OS;
const originalVersion = Platform.Version;
const setPlatform = (os: string, version: string | number) => {
  Object.defineProperty(Platform, "OS", { configurable: true, get: () => os });
  Object.defineProperty(Platform, "Version", { configurable: true, get: () => version });
};

describe("TabBar", () => {
  afterEach(() => setPlatform(originalOS, originalVersion));

  it("is a tab list", async () => {
    await renderBar();

    expect(screen.getByTestId(TAB_BAR_ITEM_PART.TRACK).props).toMatchObject({
      accessibilityRole: "tablist",
      accessibilityLabel: TRACK_LABEL,
    });
    expect(screen.getAllByRole("tab")).toHaveLength(TABS.length);
  });

  it("floats as a 64pt pill on the blurred float material, lifted by e2", async () => {
    await renderBar();

    expect(screen.getByTestId(BLUR_VIEW)).toBeTruthy();
    expect(styleOfId(TAB_BAR_ITEM_PART.TRACK)).toMatchObject({
      height: getTokenValue("$16", "size"),
      padding: PAD,
      borderRadius: getTokenValue("$pill", "radius"),
      backgroundColor: NEDAA_LIGHT.surfaceFloat.hex,
    });
    const shadow = String(styleOfId(TAB_BAR_ITEM_PART.TRACK).boxShadow);
    expect(shadow.startsWith(ELEVATION.e2.boxShadow.light)).toBe(true);
  });

  // Over a bright sky the pill keeps a faint edge of its own.
  it("rings its edge with a hairline inside", async () => {
    await renderBar();

    expect(styleOfId(TAB_BAR_ITEM_PART.TRACK).boxShadow).toBe(
      `${ELEVATION.e2.boxShadow.light}, inset 0 0 0 0.5px ${NEDAA_LIGHT.hairline.hex}`
    );
  });

  it("draws no rule along its top", async () => {
    await renderBar();

    expect(styleOfId(TAB_BAR_ITEM_PART.TRACK).borderTopWidth ?? 0).toBe(0);
  });

  // Blurring the screen behind would mean wrapping every screen in a target.
  it("keeps the opaque float colour on Android", async () => {
    setPlatform("android", 34);
    await renderBar();

    expect(screen.queryByTestId(BLUR_VIEW)).toBeNull();
    expect(styleOfId(TAB_BAR_ITEM_PART.TRACK).backgroundColor).toBe(
      `${NEDAA_LIGHT.surfaceFloat.hex.slice(0, 7)}FF`
    );
  });

  // Nothing is measured before layout, so no pill can sit in the wrong place.
  it("draws the selected pill once the bar is laid out, one tab wide", async () => {
    await renderBar();

    expect(
      screen.queryByTestId(TAB_BAR_ITEM_PART.INDICATOR, { includeHiddenElements: true })
    ).toBeNull();

    await layOut();

    expect(indicator()).toMatchObject({
      width: TAB_WIDTH,
      top: PAD,
      bottom: PAD,
      start: PAD,
      borderRadius: getTokenValue("$pill", "radius"),
      backgroundColor: NEDAA_LIGHT.accentTint.hex,
    });
  });

  it("hides the pill from the screen reader; the tab carries the state", async () => {
    await renderBar();
    await layOut();

    expect(screen.queryByTestId(TAB_BAR_ITEM_PART.INDICATOR)).toBeNull();
  });

  it.each([0, 1, 2, 3])("sits under tab %s, counted from the start", async (index) => {
    await renderBar(index);
    await layOut();

    expect(translateOf()).toBe(index * TAB_WIDTH);
  });

  // The pill is placed from the start edge, so RTL runs the other way.
  it.each([0, 1, 2, 3])("sits under tab %s in RTL", async (index) => {
    await renderBar(index, { isRTL: true });
    await layOut();

    expect(styleOfId(TAB_BAR_ITEM_PART.TRACK)).toMatchObject({ direction: "rtl" });
    expect(indicator()).toMatchObject({ start: PAD });
    expect(translateOf()).toBe(0 - index * TAB_WIDTH);
  });

  it("follows the selection on the snap spring", async () => {
    const { rerender } = await renderBar(0);
    await layOut();

    expect(withSpring).not.toHaveBeenCalled();

    await rerender(bar(2));

    expect(withSpring).toHaveBeenCalledWith(2 * TAB_WIDTH, SPRING.SNAP);
    expect(translateOf()).toBe(2 * TAB_WIDTH);
  });

  it("jumps to the new tab under reduced motion", async () => {
    mockReduced = true;
    const { rerender } = await renderBar(0);
    await layOut();

    await rerender(bar(3));

    expect(withSpring).not.toHaveBeenCalled();
    expect(translateOf()).toBe(3 * TAB_WIDTH);
  });
});
