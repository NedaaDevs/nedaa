import { Text } from "react-native";
import { screen } from "@testing-library/react-native";

import config from "../../../../tamagui.config";
import { ActionsheetIcon } from "@/components/ui/actionsheet";
import { FabIcon } from "@/components/ui/fab";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const LIGHT = config.themes.light;
const RAW = "#123456";
const GLYPH = "glyph";

/** Stands in for a lucide glyph and shows the colour it was handed. */
const Glyph = ({ color }: { color?: string }) => <Text testID={GLYPH}>{color}</Text>;

describe("Slot icon colour", () => {
  it.each([
    ["a token", "$accentPrimary", LIGHT.accentPrimary.val],
    ["a raw colour", RAW, RAW],
    ["nothing", undefined, LIGHT.typography.val],
  ])("resolves an action sheet icon given %s", async (_, color, expected) => {
    await renderWithTheme(<ActionsheetIcon as={Glyph} color={color} />);

    expect(screen.getByTestId(GLYPH)).toHaveTextContent(expected);
  });

  it.each([
    ["a token", "$accentPrimary", LIGHT.accentPrimary.val],
    ["a raw colour", RAW, RAW],
    ["nothing", undefined, LIGHT.typographyContrast.val],
  ])("resolves a floating button icon given %s", async (_, color, expected) => {
    await renderWithTheme(<FabIcon as={Glyph} color={color} />);

    expect(screen.getByTestId(GLYPH)).toHaveTextContent(expected);
  });
});
