import { Text } from "react-native";
import { screen } from "@testing-library/react-native";
import { Theme } from "tamagui";

import config from "../../../../tamagui.config";
import { Icon } from "@/components/ui/icon";
import {
  ICON_TILE_ID,
  ICON_TILE_TONE,
  IconTile,
  type IconTileTone,
} from "@/components/ui/icon-tile";
import { renderWithTheme } from "@/test-helpers/theme";

const LIGHT = config.themes.light;
const DARK = config.themes.dark;
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

const TONE_COLOR: Record<IconTileTone, string> = {
  [ICON_TILE_TONE.ACCENT]: LIGHT.accent.val,
  [ICON_TILE_TONE.SUCCESS]: LIGHT.success.val,
  [ICON_TILE_TONE.DANGER]: LIGHT.danger.val,
  [ICON_TILE_TONE.MUTED]: LIGHT.muted.val,
};

describe("IconTile tone", () => {
  it.each(Object.values(ICON_TILE_TONE))("tints the tile's glyph for %s", async (tone) => {
    await renderWithTheme(<IconTile icon={Glyph} tone={tone} />);

    expect(screen.getByTestId("glyph", { includeHiddenElements: true })).toHaveTextContent(
      TONE_COLOR[tone]
    );
  });

  it("defaults to the accent", async () => {
    await renderWithTheme(<IconTile icon={Glyph} />);

    expect(screen.getByTestId("glyph", { includeHiddenElements: true })).toHaveTextContent(
      TONE_COLOR[ICON_TILE_TONE.ACCENT]
    );
  });

  it.each([
    [ICON_TILE_TONE.ACCENT, LIGHT.tile.val],
    [ICON_TILE_TONE.MUTED, LIGHT.tile.val],
    [ICON_TILE_TONE.SUCCESS, LIGHT.successTint.val],
    [ICON_TILE_TONE.DANGER, LIGHT.dangerTint.val],
  ])("fills the tile for %s", async (tone, fill) => {
    await renderWithTheme(<IconTile icon={Glyph} tone={tone} />);

    expect(screen.getByTestId(ICON_TILE_ID, { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: fill,
    });
  });

  it.each([
    [ICON_TILE_TONE.SUCCESS, DARK.successTint.val],
    [ICON_TILE_TONE.DANGER, DARK.dangerTint.val],
  ])("fills the tile for %s in the dark theme", async (tone, fill) => {
    await renderWithTheme(
      <Theme name="dark">
        <IconTile icon={Glyph} tone={tone} />
      </Theme>
    );

    expect(screen.getByTestId(ICON_TILE_ID, { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: fill,
    });
  });
});
