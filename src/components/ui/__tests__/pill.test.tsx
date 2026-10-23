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

  it("inks the accent tone in the accent, on an accent tint", async () => {
    await renderWithTheme(
      <Pill tone={PILL_TONE.ACCENT} testID="pill">
        2.10.8
      </Pill>
    );

    expect(screen.getByText("2.10.8")).toHaveStyle({ color: NEDAA_LIGHT.accentText.hex });
    expect(screen.getByTestId("pill")).toHaveStyle({ backgroundColor: NEDAA_LIGHT.accentTint.hex });
  });

  // A tint carries the pill; a drawn line would be a control's edge.
  it.each(Object.values(PILL_TONE))("draws no border (%s)", async (tone) => {
    await renderWithTheme(
      <Pill tone={tone} testID="pill">
        Asr
      </Pill>
    );

    expect(styleOf(screen.getByTestId("pill")).borderTopWidth ?? 0).toBe(0);
  });

  it("stands at least 26 high, inset 10 at each side, its text at 12", async () => {
    await renderWithTheme(
      <Pill testID="pill" label="Next">
        Asr
      </Pill>
    );

    expect(screen.getByTestId("pill")).toHaveStyle({
      minHeight: 26,
      paddingLeft: 10,
      paddingRight: 10,
    });
    expect(screen.getByText("Asr")).toHaveStyle({ fontSize: 12 });
    expect(screen.getByText("Next")).toHaveStyle({ fontSize: 12 });
  });

  // Warn ink falls below 4.5:1 in light, so a warn tint carries the tone.
  it("tints the warn tone in the warn colour, with readable ink at 600", async () => {
    await renderWithTheme(
      <>
        <Pill tone={PILL_TONE.WARN} testID="pill">
          Debug on
        </Pill>
        <Text size="sm" fontWeight="600">
          semibold
        </Text>
      </>
    );

    expect(screen.getByTestId("pill")).toHaveStyle({ backgroundColor: NEDAA_LIGHT.warnTint.hex });
    expect(screen.getByText("Debug on")).toHaveStyle({
      color: NEDAA_LIGHT.fg.hex,
      fontSize: 12,
      fontFamily: styleOf(screen.getByText("semibold")).fontFamily,
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

  // Over the sky the chip is a quiet ink tint; the lead-in steps back in colour.
  it("tints the neutral tone quietly, its name in the ink and its lead-in muted", async () => {
    await renderWithTheme(
      <Pill tone={PILL_TONE.NEUTRAL} label="Next" testID="pill">
        Asr
      </Pill>
    );

    expect(screen.getByTestId("pill")).toHaveStyle({ backgroundColor: NEDAA_LIGHT.quietTint.hex });
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
