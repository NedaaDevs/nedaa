import { Text } from "react-native";
import { screen } from "@testing-library/react-native";
import { Theme } from "tamagui";

import { useBrightness } from "@/components/ui/theme-color";
import { BRIGHTNESS } from "@/constants/Palette";
import { AppMode } from "@/enums/app";
import { renderWithTheme } from "@/test-helpers/theme";

const Reader = () => <Text testID="brightness">{useBrightness()}</Text>;

describe("useBrightness", () => {
  it("reads light under the light theme", async () => {
    await renderWithTheme(<Reader />);

    expect(screen.getByTestId("brightness")).toHaveTextContent(BRIGHTNESS.LIGHT);
  });

  it("reads dark under the dark theme", async () => {
    await renderWithTheme(
      <Theme name={AppMode.DARK}>
        <Reader />
      </Theme>
    );

    expect(screen.getByTestId("brightness")).toHaveTextContent(BRIGHTNESS.DARK);
  });
});
