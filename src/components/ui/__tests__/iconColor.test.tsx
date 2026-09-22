import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { TamaguiProvider } from "tamagui";

import config from "../../../../tamagui.config";
import { Icon } from "@/components/ui/icon";

const LIGHT = config.themes.light;
const RAW = "#123456";

/** Stands in for a lucide glyph and shows the colour it was handed. */
const Glyph = ({ color }: { color?: string }) => <Text testID="glyph">{color}</Text>;

const renderWithTheme = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }) => (
      <TamaguiProvider config={config} defaultTheme="light">
        {children}
      </TamaguiProvider>
    ),
  });

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
