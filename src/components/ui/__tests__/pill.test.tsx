import { screen } from "@testing-library/react-native";

import { PILL_PART, PILL_TONE, Pill } from "@/components/ui/pill";
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

  // A lead-in reads before the value, lighter, so no colon has to join them.
  it("sets a lead-in before its text, lighter than it", async () => {
    await renderWithTheme(<Pill label="Next prayer">Asr</Pill>);

    expect(screen.getByText("Next prayer")).toBeTruthy();
    expect(styleOf(screen.getByText("Next prayer")).fontFamily).not.toBe(
      styleOf(screen.getByText("Asr")).fontFamily
    );
  });

  it.each(Object.values(PILL_TONE))(
    "marks its start with a round accent dot, hidden from the reader (%s)",
    async (tone) => {
      await renderWithTheme(
        <Pill dot tone={tone}>
          Asr
        </Pill>
      );

      expect(screen.getByTestId(PILL_PART.DOT, { includeHiddenElements: true })).toHaveStyle({
        backgroundColor: NEDAA_LIGHT.accent.hex,
        borderTopLeftRadius: 999,
      });
      expect(screen.queryByTestId(PILL_PART.DOT)).toBeNull();
    }
  );

  // Over the sky the chip keeps a quiet edge; the lead-in steps back in colour.
  it("edges the neutral tone plainly, its name in the ink and its lead-in muted", async () => {
    await renderWithTheme(
      <Pill tone={PILL_TONE.NEUTRAL} label="Next" testID="pill">
        Asr
      </Pill>
    );

    expect(screen.getByTestId("pill")).toHaveStyle({ borderTopColor: NEDAA_LIGHT.border.hex });
    expect(screen.getByText("Asr")).toHaveStyle({ color: NEDAA_LIGHT.fg.hex });
    expect(screen.getByText("Next")).toHaveStyle({ color: NEDAA_LIGHT.mutedSky.hex });
  });

  it.each([
    [undefined, "center"],
    ["flex-start", "flex-start"],
  ] as const)("aligns itself as asked (%s)", async (alignSelf, expected) => {
    await renderWithTheme(
      <Pill alignSelf={alignSelf} testID="pill">
        Asr
      </Pill>
    );

    expect(screen.getByTestId("pill")).toHaveStyle({ alignSelf: expected });
  });

  it("has no dot unless asked", async () => {
    await renderWithTheme(<Pill>2.10.8</Pill>);

    expect(screen.queryByTestId(PILL_PART.DOT, { includeHiddenElements: true })).toBeNull();
  });
});
