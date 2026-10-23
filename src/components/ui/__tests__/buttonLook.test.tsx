import { screen } from "@testing-library/react-native";
import { getTokenValue } from "tamagui";

import config from "../../../../tamagui.config";
import { Button } from "@/components/ui/button";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { styleOf } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";

const lightTheme = config.themes.light as Record<string, { val: string }>;

const renderButton = (props: Parameters<typeof Button>[0] = {}) =>
  renderWithTheme(
    <Button onPress={jest.fn()} {...props}>
      <Button.Text>Retry</Button.Text>
    </Button>
  );

const frame = () => styleOf(screen.getByRole("button", { name: "Retry" }));
const label = () => styleOf(screen.getByText("Retry"));

describe("Button look", () => {
  // The button's inset is its own; a section gap may grow without moving it.
  it("pads the md button 20 at each side, apart from the section gap", async () => {
    await renderButton();

    expect(frame()).toMatchObject({ paddingLeft: 20, paddingRight: 20 });
    expect(frame().paddingLeft).not.toBe(getTokenValue("$section", "space"));
  });

  it("rounds every button as a control", async () => {
    await renderButton();

    expect(frame().borderTopLeftRadius).toBe(getTokenValue("$control", "radius"));
  });

  it("fills the primary button with the accent, lit by the accent glow", async () => {
    await renderButton();

    expect(frame().backgroundColor).toBe(NEDAA_LIGHT.accent.hex);
    expect(String(frame().boxShadow)).toContain(NEDAA_LIGHT.accentGlow.hex);
    expect(label().color).toBe(NEDAA_LIGHT.bg.hex);
  });

  // The secondary button carries no stroke: a glass fill and an inset hairline.
  it("draws the outline button as glass with an inset hairline ring", async () => {
    await renderButton({ variant: "outline" });

    expect(frame().backgroundColor).toBe(NEDAA_LIGHT.surfaceGlass.hex);
    expect(frame().borderTopWidth ?? 0).toBe(0);
    expect(String(frame().boxShadow)).toContain(`inset 0 0 0 1px ${NEDAA_LIGHT.hairline.hex}`);
    expect(label().color).toBe(NEDAA_LIGHT.fg.hex);
  });

  // A destructive or confirming outline keeps its tone in the label and the ring.
  it.each([
    ["negative", "error"],
    ["positive", "success"],
  ] as const)("inks the %s outline label and ring in $%s", async (action, key) => {
    await renderButton({ action, variant: "outline" });
    const tone = lightTheme[key].val;

    expect(label().color).toBe(tone);
    expect(String(frame().boxShadow)).toContain(`inset 0 0 0 1px ${tone}`);
  });

  it("sets the md button 50 high, its label at 16", async () => {
    await renderButton();

    expect(frame().minHeight).toBe(50);
    expect(label().fontSize).toBe(16);
  });

  it("sets the text button in the accent, 44 high, inset 8", async () => {
    await renderButton({ variant: "link" });

    expect(frame()).toMatchObject({ minHeight: 44, paddingLeft: 8, paddingRight: 8 });
    expect(frame().backgroundColor).toBe("transparent");
    expect(label().color).toBe(NEDAA_LIGHT.accent.hex);
  });

  // Only the primary call to action glows; a status button stays flat.
  it("keeps a solid status button flat, its label in the contrast ink", async () => {
    await renderButton({ action: "negative" });

    expect(frame().boxShadow).toBeUndefined();
    expect(label().color).not.toBe(NEDAA_LIGHT.bg.hex);
  });
});
