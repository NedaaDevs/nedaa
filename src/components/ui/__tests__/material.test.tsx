import { Platform, StyleSheet } from "react-native";
import { screen } from "@testing-library/react-native";
import { getTokenValue, Theme } from "tamagui";

import { Material } from "@/components/ui/material";
import { BLUR_INTENSITY } from "@/constants/Blur";
import { ELEVATION } from "@/constants/Elevation";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { renderWithTheme } from "@/test-helpers/theme";

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

beforeEach(() => {
  mockReduceTransparency = false;
  setPlatform("ios", "26.0");
});

afterEach(() => setPlatform(originalOS, originalVersion));

describe("Material", () => {
  it("blurs a float material at the float intensity on iOS", async () => {
    await renderWithTheme(<Material testID="material" material="float" />);

    expect(screen.getByTestId("blur-view").props.intensity).toBe(BLUR_INTENSITY.FLOAT);
  });

  // BlurView ignores borderRadius unless it clips, so its corners would show.
  it("clips the blur to its rounded corners", async () => {
    await renderWithTheme(<Material testID="material" material="float" />);

    expect(StyleSheet.flatten(screen.getByTestId("blur-view").props.style)).toMatchObject({
      overflow: "hidden",
    });
  });

  it("blurs a sheet header at the sheet intensity", async () => {
    await renderWithTheme(<Material testID="material" material="sheetHeader" />);

    expect(screen.getByTestId("blur-view").props.intensity).toBe(BLUR_INTENSITY.SHEET);
  });

  it("tints the blur with the translucent float colour", async () => {
    await renderWithTheme(<Material testID="material" material="float" />);

    expect(fill().backgroundColor).toBe(NEDAA_LIGHT.surfaceFloat.hex);
  });

  it("draws the float colour at full alpha and no blur under Reduce Transparency", async () => {
    mockReduceTransparency = true;
    await renderWithTheme(<Material testID="material" material="float" />);

    expect(screen.queryByTestId("blur-view")).toBeNull();
    expect(fill().backgroundColor).toBe(`${NEDAA_LIGHT.surfaceFloat.hex.slice(0, 7)}FF`);
  });

  it("draws no blur on Android 30", async () => {
    setPlatform("android", 30);
    await renderWithTheme(<Material testID="material" material="float" />);

    expect(screen.queryByTestId("blur-view")).toBeNull();
  });

  it("draws no blur on Android 34 without a blur target", async () => {
    setPlatform("android", 34);
    await renderWithTheme(<Material testID="material" material="float" />);

    expect(screen.queryByTestId("blur-view")).toBeNull();
  });

  // The float colour carries the tint; the thin material adds saturation.
  it("tints the light theme's blur with the thin light material", async () => {
    await renderWithTheme(<Material testID="material" material="float" />);

    expect(screen.getByTestId("blur-view").props.tint).toBe("systemUltraThinMaterialLight");
  });

  it("tints the dark theme's blur with the thin dark material", async () => {
    await renderWithTheme(
      <Theme name="dark">
        <Material testID="material" material="float" />
      </Theme>
    );

    expect(screen.getByTestId("blur-view").props.tint).toBe("systemUltraThinMaterialDark");
  });

  // A sheet header is the top of a sheet: its lower edge meets the body square.
  it("rounds a sheet header and its blur at the top corners only", async () => {
    await renderWithTheme(<Material testID="material" material="sheetHeader" radius="sheet" />);
    const sheet = getTokenValue("$sheet", "radius");
    const blur = StyleSheet.flatten(screen.getByTestId("blur-view").props.style);

    for (const style of [fill(), blur]) {
      expect(style).toMatchObject({ borderTopStartRadius: sheet, borderTopEndRadius: sheet });
      expect(style.borderBottomStartRadius ?? 0).toBe(0);
      expect(style.borderBottomLeftRadius ?? 0).toBe(0);
      expect(style.borderRadius ?? 0).toBe(0);
    }
  });

  // Android elevation shows through a see-through fill, so it is never set.
  it.each([
    ["ios", "26.0"],
    ["android", 34],
    ["android", 30],
  ] as const)("lifts with boxShadow alone on %s %s", async (os, version) => {
    setPlatform(os, version);
    await renderWithTheme(<Material testID="material" material="float" elevation="e2" />);

    expect(fill().boxShadow).toBe(ELEVATION.e2.boxShadow.light);
    expect(fill().elevation ?? 0).toBe(0);
  });

  it("draws the highlight edge", async () => {
    await renderWithTheme(<Material testID="material" material="float" />);

    expect(screen.getByTestId("material-highlight")).toBeTruthy();
  });
});
