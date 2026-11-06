import { screen } from "@testing-library/react-native";

import config from "../../../../tamagui.config";
import { Divider } from "@/components/ui/divider";
import { renderWithTheme } from "@/test-helpers/theme";

const RULE = "rule";

describe("Divider", () => {
  it("draws in the palette's hairline colour", async () => {
    await renderWithTheme(<Divider testID={RULE} />);

    expect(screen.getByTestId(RULE)).toHaveStyle({
      backgroundColor: config.themes.light.hairline.val,
    });
  });

  // A rule drawn as a border on a zero-height box adds nothing to its parent's
  // height, so a long list comes out shorter than its rows and clips the last.
  it("takes its own height in the layout", async () => {
    await renderWithTheme(<Divider testID={RULE} />);

    const rule = screen.getByTestId(RULE);
    expect(rule).toHaveStyle({ height: 1, flexShrink: 0 });
    expect(rule).not.toHaveStyle({ maxHeight: 0 });
  });

  it("stands as tall as its row when vertical", async () => {
    await renderWithTheme(<Divider testID={RULE} orientation="vertical" />);

    expect(screen.getByTestId(RULE)).toHaveStyle({ width: 1, alignSelf: "stretch" });
  });
});
