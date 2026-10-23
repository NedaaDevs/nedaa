import { Platform, StyleSheet, View } from "react-native";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { getTokenValue } from "tamagui";

import { Fab, FAB_PART } from "@/components/ui/fab";
import { ELEVATION } from "@/constants/Elevation";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { AppDirection } from "@/enums/app";
import { PHONE_APP_PAIRS, onPhone } from "@/test-helpers/nativeSurface";
import { renderWithTheme } from "@/test-helpers/theme";
import { layOutSpans } from "@/test-helpers/yogaPlacement";

const FAB_ID = "fab";
const SCREEN_WIDTH = 390;

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

const originalOS = Platform.OS;
const originalVersion = Platform.Version;
const setPlatform = (os: string, version: string | number) => {
  Object.defineProperty(Platform, "OS", { configurable: true, get: () => os });
  Object.defineProperty(Platform, "Version", { configurable: true, get: () => version });
};

const surface = () => StyleSheet.flatten(screen.getByTestId(FAB_PART.SURFACE).props.style);
const transformOf = () => StyleSheet.flatten(screen.getByTestId(FAB_ID).props.style).transform;
const press = () => act(() => fireEvent(screen.getByTestId(FAB_ID), "responderGrant", {}));

describe("Fab surface", () => {
  beforeEach(() => {
    mockReduced = false;
  });
  afterEach(() => setPlatform(originalOS, originalVersion));

  it("floats on the blurred float material, round and lifted by e2", async () => {
    await renderWithTheme(<Fab testID={FAB_ID} onPress={jest.fn()} />);

    expect(screen.getByTestId(BLUR_VIEW)).toBeTruthy();
    expect(surface()).toMatchObject({
      backgroundColor: NEDAA_LIGHT.surfaceFloat.hex,
      boxShadow: ELEVATION.e2.boxShadow.light,
      borderRadius: getTokenValue("$pill", "radius"),
    });
  });

  // Blurring the screen behind would mean wrapping every screen in a target.
  it("keeps the opaque float colour on Android", async () => {
    setPlatform("android", 34);
    await renderWithTheme(<Fab testID={FAB_ID} onPress={jest.fn()} />);

    expect(screen.queryByTestId(BLUR_VIEW)).toBeNull();
    expect(surface().backgroundColor).toBe(`${NEDAA_LIGHT.surfaceFloat.hex.slice(0, 7)}FF`);
  });

  it("draws its icon in the accent", async () => {
    const Glyph = ({ color }: { size?: number; color?: string }) => (
      <View testID="glyph" accessibilityLabel={color} />
    );
    await renderWithTheme(
      <Fab testID={FAB_ID} onPress={jest.fn()}>
        <Fab.Icon as={Glyph} />
      </Fab>
    );

    expect(screen.getByTestId("glyph").props.accessibilityLabel).toBe(NEDAA_LIGHT.accent.hex);
  });

  it("shrinks to .98 under the finger", async () => {
    await renderWithTheme(<Fab testID={FAB_ID} onPress={jest.fn()} />);

    await press();

    expect(transformOf()).toEqual([{ scale: 0.98 }]);
  });

  it("holds still under reduced motion", async () => {
    mockReduced = true;
    await renderWithTheme(<Fab testID={FAB_ID} onPress={jest.fn()} />);

    await press();

    expect(transformOf()).toBeUndefined();
  });
});

describe("Fab placement", () => {
  it.each(PHONE_APP_PAIRS)(
    "puts a bottom end Fab at the reading end on a $phone phone in a $app app",
    async ({ phone, app }) => {
      await renderWithTheme(<Fab testID={FAB_ID} placement="bottom end" />, {
        isRTL: app === AppDirection.RTL,
      });

      const [, fab] = await layOutSpans(
        {
          style: { width: SCREEN_WIDTH },
          children: [
            { style: onPhone(StyleSheet.flatten(screen.getByTestId(FAB_ID).props.style), phone) },
          ],
        },
        app
      );

      const leftGap = fab.left;
      const rightGap = SCREEN_WIDTH - fab.left - fab.width;
      const [endGap, startGap] =
        app === AppDirection.RTL ? [leftGap, rightGap] : [rightGap, leftGap];
      expect(endGap).toBe(getTokenValue("$group", "space"));
      expect(endGap).toBeLessThan(startGap);
    }
  );
});
