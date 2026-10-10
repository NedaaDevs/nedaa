import { screen } from "@testing-library/react-native";

import config from "../../../../tamagui.config";
import { Divider } from "@/components/ui/divider";
import { renderWithTheme } from "@/test-helpers/theme";

const RULE = "rule";

describe("Divider", () => {
  // Tamagui sets each side's colour; a horizontal rule draws its bottom edge.
  it("draws in the palette's border colour", async () => {
    await renderWithTheme(<Divider testID={RULE} />);

    expect(screen.getByTestId(RULE)).toHaveStyle({
      borderBottomColor: config.themes.light.border.val,
    });
  });
});
