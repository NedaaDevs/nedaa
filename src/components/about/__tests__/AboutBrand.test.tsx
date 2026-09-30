import { screen } from "@testing-library/react-native";
import { Theme } from "tamagui";

import { ABOUT_BRAND_PART, AboutBrand } from "@/components/about/AboutBrand";
import { AppMode } from "@/enums/app";
import { renderWithTheme } from "@/test-helpers/theme";

const LIGHT_ICON = require("@/../assets/images/icon.png");
const DARK_ICON = require("@/../assets/images/ios-dark.png");

const iconSource = () => screen.getByTestId(ABOUT_BRAND_PART.ICON).props.source;

describe("AboutBrand", () => {
  it("shows the light app icon in the light theme", async () => {
    await renderWithTheme(<AboutBrand />);

    expect(iconSource()).toBe(LIGHT_ICON);
  });

  // The dark icon matches what the home screen shows in dark mode.
  it("shows the dark app icon in the dark theme", async () => {
    await renderWithTheme(
      <Theme name={AppMode.DARK}>
        <AboutBrand />
      </Theme>
    );

    expect(iconSource()).toBe(DARK_ICON);
  });
});
