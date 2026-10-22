import { Platform, StyleSheet } from "react-native";
import { screen } from "@testing-library/react-native";

import { Material } from "@/components/ui/material";
import { BLUR_INTENSITY } from "@/constants/Blur";
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

  it("draws the highlight edge", async () => {
    await renderWithTheme(<Material testID="material" material="float" />);

    expect(screen.getByTestId("material-highlight")).toBeTruthy();
  });
});
