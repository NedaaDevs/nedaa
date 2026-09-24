import { screen } from "@testing-library/react-native";

import { Text } from "@/components/ui/text";
import { renderWithTheme } from "@/test-helpers/theme";

// The primitive reads the platform once, as it loads; this file runs as Android.
jest.mock("react-native", () => {
  const native = jest.requireActual("react-native");
  native.Platform.OS = "android";
  return native;
});

describe("Text on Android", () => {
  // Android measures Arabic words short, so running text gets room at its end.
  it("gives running text room at its end", async () => {
    await renderWithTheme(<Text>العصر</Text>);

    expect(screen.getByText("العصر")).toHaveStyle({ paddingEnd: 8 });
  });

  // A lone digit or separator is measured right; the room would space it apart.
  it("sets a glyph exactly, with no room added", async () => {
    await renderWithTheme(<Text glyph>7</Text>);

    expect(screen.getByText("7")).not.toHaveStyle({ paddingEnd: 8 });
  });
});
