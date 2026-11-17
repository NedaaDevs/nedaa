import { readFileSync } from "fs";
import { join } from "path";

import { render, screen } from "@testing-library/react-native";

const SCREEN = "athkar-focus-screen";
const mockSeed = jest.fn(() => false);

jest.mock("@/components/athkar/session/AthkarFocusScreen", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return { AthkarFocusScreen: () => <Text>athkar-focus-screen</Text> };
});
jest.mock("@/components/athkar/useAthkarScreenshotSeed", () => ({
  useAthkarFocusScreenshotSeed: () => mockSeed(),
}));

/* eslint-disable import/first -- imports must follow jest.mock hoisting */
import AthkarFocusRoute from "@/app/athkar-focus";
/* eslint-enable import/first */

describe("the athkar-focus route", () => {
  it("draws the Focus screen and seeds it for screenshots", async () => {
    await render(<AthkarFocusRoute />);
    expect(screen.getByText(SCREEN)).toBeOnTheScreen();
    expect(mockSeed).toHaveBeenCalled();
  });

  it("suppresses no hook rule, so the compiler keeps the screen", () => {
    const sources = [
      "app/athkar-focus.tsx",
      "components/athkar/session/AthkarFocusScreen.tsx",
      "components/athkar/looks/classic/ClassicFocus.tsx",
      "components/athkar/looks/classic/FocusOrbit.tsx",
      "hooks/useFocusGesture.ts",
    ].map((file) => readFileSync(join(__dirname, "../..", file), "utf8"));
    expect(sources.filter((source) => /react-hooks\//.test(source))).toEqual([]);
  });
});
