import { screen } from "@testing-library/react-native";

import { PILL_TONE, Pill } from "@/components/ui/pill";
import { Text } from "@/components/ui/text";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { styleOf } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";

describe("Pill", () => {
  it("shows its text", async () => {
    await renderWithTheme(<Pill>2.10.8</Pill>);

    expect(screen.getByText("2.10.8")).toBeTruthy();
  });

  it("inks the accent tone in the accent", async () => {
    await renderWithTheme(<Pill tone={PILL_TONE.ACCENT}>2.10.8</Pill>);

    expect(screen.getByText("2.10.8")).toHaveStyle({ color: NEDAA_LIGHT.accent.hex });
  });

  // Warn ink on surface-2 falls below 4.5:1 in light, so the edge carries it.
  it("edges the warn tone in the warn colour, with bold readable ink", async () => {
    await renderWithTheme(
      <>
        <Pill tone={PILL_TONE.WARN} testID="pill">
          Debug on
        </Pill>
        <Text size="xs" bold>
          bold
        </Text>
      </>
    );

    expect(screen.getByTestId("pill")).toHaveStyle({
      borderTopColor: NEDAA_LIGHT.warn.hex,
      backgroundColor: NEDAA_LIGHT.surface2.hex,
    });
    expect(screen.getByText("Debug on")).toHaveStyle({
      color: NEDAA_LIGHT.fg.hex,
      fontFamily: styleOf(screen.getByText("bold")).fontFamily,
    });
  });
});
