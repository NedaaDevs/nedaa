import { Text } from "react-native";
import { screen } from "@testing-library/react-native";

import {
  CLASSIC_GROUND_PART,
  ClassicGround,
} from "@/components/athkar/looks/classic/ClassicGround";
import { SkyBackground } from "@/components/ui/sky-background";
import { BRIGHTNESS, NEDAA_LIGHT } from "@/constants/Palette";
import { renderWithTheme } from "@/test-helpers/theme";
import { focusWashImage } from "@/utils/athkarGround";

jest.mock("expo-blur", () => jest.requireActual("@/test-helpers/blurMock"));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

const hidden = { includeHiddenElements: true };

const renderGround = () =>
  renderWithTheme(
    <SkyBackground>
      <ClassicGround>
        <Text>dhikr</Text>
      </ClassicGround>
    </SkyBackground>
  );

describe("ClassicGround", () => {
  it("washes the sky into the ground behind its content", async () => {
    await renderGround();
    expect(screen.getByTestId(CLASSIC_GROUND_PART.WASH, hidden)).toHaveStyle({
      experimental_backgroundImage: focusWashImage(NEDAA_LIGHT.bg.hex, BRIGHTNESS.LIGHT),
    });
    expect(screen.getByText("dhikr")).toBeOnTheScreen();
  });
});
