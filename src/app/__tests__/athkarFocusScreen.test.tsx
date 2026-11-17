import { readFileSync } from "fs";
import { join } from "path";

import { screen } from "@testing-library/react-native";

const SCREEN = "athkar-focus-screen";
const mockSeed = jest.fn(() => false);

jest.mock("@/components/athkar/session/AthkarFocusScreen", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return { AthkarFocusScreen: () => <Text>athkar-focus-screen</Text> };
});
jest.mock("expo-router", () => ({ useIsFocused: () => true }));
jest.mock("@/components/athkar/useAthkarScreenshotSeed", () => ({
  useAthkarFocusScreenshotSeed: () => mockSeed(),
}));

/* eslint-disable import/first -- imports must follow jest.mock hoisting */
import AthkarFocusRoute from "@/app/athkar-focus";
import { SKY_PART } from "@/components/ui/sky-background";
import { renderWithTheme } from "@/test-helpers/theme";
/* eslint-enable import/first */

describe("the athkar-focus route", () => {
  it("draws the Focus screen and seeds it for screenshots", async () => {
    await renderWithTheme(<AthkarFocusRoute />);
    expect(screen.getByText(SCREEN)).toBeOnTheScreen();
    expect(mockSeed).toHaveBeenCalled();
  });

  it("draws one sky under the screen", async () => {
    await renderWithTheme(<AthkarFocusRoute />);
    expect(screen.getAllByTestId(SKY_PART.CANVAS, { includeHiddenElements: true })).toHaveLength(1);
  });

  it("suppresses no hook rule, so the compiler keeps the screen", () => {
    const sources = [
      "app/athkar-focus.tsx",
      "components/athkar/session/AthkarFocusScreen.tsx",
      "components/athkar/looks/classic/ClassicFocus.tsx",
      "components/athkar/looks/classic/FocusOrbit.tsx",
      "components/athkar/looks/classic/ClassicGround.tsx",
      "hooks/useFocusGesture.ts",
    ].map((file) => readFileSync(join(__dirname, "../..", file), "utf8"));
    expect(sources.filter((source) => /react-hooks\//.test(source))).toEqual([]);
  });
});
