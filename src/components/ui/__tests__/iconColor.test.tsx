import { Text } from "react-native";
import { screen } from "@testing-library/react-native";

import config from "../../../../tamagui.config";
import { Icon } from "@/components/ui/icon";
import { renderWithTheme } from "@/test-helpers/theme";

const LIGHT = config.themes.light;
const RAW = "#123456";

/** Stands in for a lucide glyph and shows the colour it was handed. */
const Glyph = ({ color }: { color?: string }) => <Text testID="glyph">{color}</Text>;

describe("Icon colour", () => {
  it.each([
    ["a token", "$accentPrimary", LIGHT.accentPrimary.val],
    ["a raw colour", RAW, RAW],
    ["nothing", undefined, LIGHT.typography.val],
  ])("hands the glyph %s resolved", async (_, color, expected) => {
    await renderWithTheme(<Icon as={Glyph} color={color} />);

    // A glyph with no label is decorative, so Icon hides it from the screen reader.
    expect(screen.getByTestId("glyph", { includeHiddenElements: true })).toHaveTextContent(
      expected
    );
  });
});

/** Shows the fill it was handed, or that it had none. */
const FilledGlyph = ({ fill }: { fill?: string }) => (
  <Text testID="glyph">{fill ?? "no fill"}</Text>
);

describe("Icon fill", () => {
  it("resolves a token fill against the theme", async () => {
    await renderWithTheme(<Icon as={FilledGlyph} fill="$danger" />);

    expect(screen.getByTestId("glyph", { includeHiddenElements: true })).toHaveTextContent(
      LIGHT.danger.val
    );
  });

  // Lucide leaves an unfilled glyph hollow; a custom glyph keeps its own default.
  it("hands no fill when none is asked for", async () => {
    await renderWithTheme(<Icon as={FilledGlyph} />);

    expect(screen.getByTestId("glyph", { includeHiddenElements: true })).toHaveTextContent(
      "no fill"
    );
  });
});
