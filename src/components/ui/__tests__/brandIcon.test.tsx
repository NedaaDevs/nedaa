import { screen } from "@testing-library/react-native";
import { Theme } from "tamagui";

import { BRAND_ICON_FRAME, BrandIcon } from "@/components/ui/brand-icon";
import { AppMode } from "@/enums/app";
import { renderWithTheme } from "@/test-helpers/theme";

const LIGHT_ICON = require("@/../assets/images/icon.png");
const DARK_ICON = require("@/../assets/images/ios-dark.png");
const IMAGE = "brand-icon-image";

const iconSource = () => screen.getByTestId(IMAGE).props.source;

describe("BrandIcon", () => {
  it("shows the light app icon in the light theme", async () => {
    await renderWithTheme(<BrandIcon size="$14" testID={IMAGE} />);

    expect(iconSource()).toBe(LIGHT_ICON);
  });

  // The dark icon is the one the home screen shows in dark mode.
  it("shows the dark app icon in the dark theme", async () => {
    await renderWithTheme(
      <Theme name={AppMode.DARK}>
        <BrandIcon size="$14" testID={IMAGE} />
      </Theme>
    );

    expect(iconSource()).toBe(DARK_ICON);
  });

  it.each([
    ["$14", 56],
    ["$24", 96],
  ] as const)("is a square of the %s size token", async (size, points) => {
    await renderWithTheme(<BrandIcon size={size} />);

    expect(screen.getByTestId(BRAND_ICON_FRAME)).toHaveStyle({ width: points, height: points });
  });
});
