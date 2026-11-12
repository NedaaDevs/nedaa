import { createRef } from "react";
import { Platform, StyleSheet, type ViewInstance } from "react-native";
import { screen } from "@testing-library/react-native";
import { getTokenValue, Theme } from "tamagui";

import { MATERIAL, Material, materialTintId } from "@/components/ui/material";
import { chooseMaterialSurface, MATERIAL_SURFACE } from "@/components/ui/material/surface";
import { BLUR_INTENSITY } from "@/constants/Blur";
import { ELEVATION } from "@/constants/Elevation";
import { NEDAA_DARK, NEDAA_LIGHT } from "@/constants/Palette";
import { AppMode, PlatformType } from "@/enums/app";
import { renderWithTheme } from "@/test-helpers/theme";

const BLUR_VIEW = "blur-view";
jest.mock("expo-blur", () => {
  const { createElement } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return { BlurView: (props: object) => createElement(View, { testID: "blur-view", ...props }) };
});

let mockReduceTransparency = false;
jest.mock("@/hooks/useReduceTransparency", () => ({
  useReduceTransparency: () => mockReduceTransparency,
}));

const originalOS = Platform.OS;
const originalVersion = Platform.Version;

const setPlatform = (os: string, version: string | number) => {
  Object.defineProperty(Platform, "OS", { configurable: true, get: () => os });
  Object.defineProperty(Platform, "Version", { configurable: true, get: () => version });
};

const fill = () => StyleSheet.flatten(screen.getByTestId("material").props.style);
const tintLayer = () =>
  StyleSheet.flatten(screen.getByTestId(materialTintId("material")).props.style);

const opaque = (hex: string) => `${hex.slice(0, 7)}FF`;

const LAYER = { BLUR: "blur", TINT: "tint" } as const;

/** The blur and every view filled with the tint, in paint order. */
const paintOrder = (tint: string) =>
  screen.container
    .queryAll(
      (node) =>
        node.props.testID === BLUR_VIEW ||
        StyleSheet.flatten(node.props.style)?.backgroundColor === tint
    )
    .map((node) => (node.props.testID === BLUR_VIEW ? LAYER.BLUR : LAYER.TINT));

const DEVICES = [
  {
    name: "iOS 26",
    platform: PlatformType.IOS,
    version: "26.0",
    apiLevel: 0,
    reduceTransparency: false,
    hasBlurTarget: false,
  },
  {
    name: "iOS 26 with Reduce Transparency",
    platform: PlatformType.IOS,
    version: "26.0",
    apiLevel: 0,
    reduceTransparency: true,
    hasBlurTarget: false,
  },
  {
    name: "Android 34 with a blur target",
    platform: PlatformType.ANDROID,
    version: 34,
    apiLevel: 34,
    reduceTransparency: false,
    hasBlurTarget: true,
  },
  {
    name: "Android 34 without a blur target",
    platform: PlatformType.ANDROID,
    version: 34,
    apiLevel: 34,
    reduceTransparency: false,
    hasBlurTarget: false,
  },
  {
    name: "Android 30 with a blur target",
    platform: PlatformType.ANDROID,
    version: 30,
    apiLevel: 30,
    reduceTransparency: false,
    hasBlurTarget: true,
  },
] as const;

const THEMES = [
  [AppMode.LIGHT, NEDAA_LIGHT],
  [AppMode.DARK, NEDAA_DARK],
] as const;

const PAINT_CASES = Object.values(MATERIAL).flatMap((material) =>
  THEMES.flatMap(([mode, palette]) =>
    DEVICES.map((device) => ({ material, mode, palette, device }))
  )
);

beforeEach(() => {
  mockReduceTransparency = false;
  setPlatform(PlatformType.IOS, "26.0");
});

afterEach(() => setPlatform(originalOS, originalVersion));

// The design paints the tint over the blurred backdrop, once.
describe("Material paint order", () => {
  it.each(PAINT_CASES)(
    "$material in $mode on $device.name: tint once, above any blur",
    async ({ material, mode, palette, device }) => {
      setPlatform(device.platform, device.version);
      mockReduceTransparency = device.reduceTransparency;
      const blurs = chooseMaterialSurface(device) === MATERIAL_SURFACE.BLUR;
      const tint = blurs ? palette.surfaceFloat.hex : opaque(palette.surfaceFloat.hex);

      await renderWithTheme(
        <Theme name={mode}>
          <Material
            testID="material"
            material={material}
            blurTarget={device.hasBlurTarget ? createRef<ViewInstance>() : undefined}
          />
        </Theme>
      );

      expect(paintOrder(tint)).toEqual(blurs ? [LAYER.BLUR, LAYER.TINT] : [LAYER.TINT]);
    }
  );
});

describe("Material", () => {
  it("blurs a float material at the float intensity on iOS", async () => {
    await renderWithTheme(<Material testID="material" material={MATERIAL.FLOAT} />);

    expect(screen.getByTestId(BLUR_VIEW).props.intensity).toBe(BLUR_INTENSITY.FLOAT);
  });

  // BlurView ignores borderRadius unless it clips, so its corners would show.
  it("clips the blur to its rounded corners", async () => {
    await renderWithTheme(<Material testID="material" material={MATERIAL.FLOAT} />);

    expect(StyleSheet.flatten(screen.getByTestId(BLUR_VIEW).props.style)).toMatchObject({
      overflow: "hidden",
    });
  });

  it("blurs a sheet header at the sheet intensity", async () => {
    await renderWithTheme(<Material testID="material" material={MATERIAL.SHEET_HEADER} />);

    expect(screen.getByTestId(BLUR_VIEW).props.intensity).toBe(BLUR_INTENSITY.SHEET);
  });

  it("draws no blur on Android 30", async () => {
    setPlatform(PlatformType.ANDROID, 30);
    await renderWithTheme(<Material testID="material" material={MATERIAL.FLOAT} />);

    expect(screen.queryByTestId(BLUR_VIEW)).toBeNull();
  });

  it("draws no blur on Android 34 without a blur target", async () => {
    setPlatform(PlatformType.ANDROID, 34);
    await renderWithTheme(<Material testID="material" material={MATERIAL.FLOAT} />);

    expect(screen.queryByTestId(BLUR_VIEW)).toBeNull();
  });

  // The float colour carries the tint; the thin material adds saturation.
  it("tints the light theme's blur with the thin light material", async () => {
    await renderWithTheme(<Material testID="material" material={MATERIAL.FLOAT} />);

    expect(screen.getByTestId(BLUR_VIEW).props.tint).toBe("systemUltraThinMaterialLight");
  });

  it("tints the dark theme's blur with the thin dark material", async () => {
    await renderWithTheme(
      <Theme name={AppMode.DARK}>
        <Material testID="material" material={MATERIAL.FLOAT} />
      </Theme>
    );

    expect(screen.getByTestId(BLUR_VIEW).props.tint).toBe("systemUltraThinMaterialDark");
  });

  // A sheet header is the top of a sheet: its lower edge meets the body square.
  it("rounds a sheet header and its blur at the top corners only", async () => {
    await renderWithTheme(
      <Material testID="material" material={MATERIAL.SHEET_HEADER} radius="$sheet" />
    );
    const sheet = getTokenValue("$sheet", "radius");
    const blur = StyleSheet.flatten(screen.getByTestId(BLUR_VIEW).props.style);

    for (const style of [fill(), blur, tintLayer()]) {
      expect(style).toMatchObject({ borderTopStartRadius: sheet, borderTopEndRadius: sheet });
      expect(style.borderBottomStartRadius ?? 0).toBe(0);
      expect(style.borderBottomLeftRadius ?? 0).toBe(0);
      expect(style.borderRadius ?? 0).toBe(0);
    }
  });

  // Android elevation shows through a see-through fill, so it is never set.
  it.each([
    [PlatformType.IOS, "26.0"],
    [PlatformType.ANDROID, 34],
    [PlatformType.ANDROID, 30],
  ] as const)("lifts with boxShadow alone on %s %s", async (os, version) => {
    setPlatform(os, version);
    await renderWithTheme(<Material testID="material" material={MATERIAL.FLOAT} />);

    expect(fill().boxShadow).toBe(ELEVATION.e2.boxShadow.light);
    expect(fill().elevation ?? 0).toBe(0);
  });

  // The header lies flat on its own sheet.
  it("lifts a sheet header not at all", async () => {
    await renderWithTheme(<Material testID="material" material={MATERIAL.SHEET_HEADER} />);

    expect(fill().boxShadow).toBeUndefined();
  });

  // A 999 corner is wider than the bar, so the lit line follows the curve.
  it("lights a pill's top edge along its curve", async () => {
    await renderWithTheme(<Material testID="material" material={MATERIAL.FLOAT} radius="$pill" />);
    const edge = StyleSheet.flatten(screen.getByTestId("material-highlight").props.style);
    const pill = getTokenValue("$pill", "radius");

    expect(edge).toMatchObject({
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      borderTopLeftRadius: pill,
      borderTopRightRadius: pill,
      boxShadow: `inset 0 1px 0 ${NEDAA_LIGHT.highlight.hex}`,
    });
  });
});
