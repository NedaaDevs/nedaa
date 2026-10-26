import { StyleSheet, Text } from "react-native";
import { AlarmClock } from "lucide-react-native";
import { act, fireEvent, screen } from "@testing-library/react-native";

import config from "../../../../tamagui.config";
import { Card } from "@/components/ui/card";
import { LIST_GROUP_PART, ListGroup } from "@/components/ui/list-group";
import { ICON_TILE_ID } from "@/components/ui/icon-tile";
import { LIST_ROW_PART, LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { PLACE_HERO_PART, PlaceHero } from "@/components/ui/place-hero";
import { ELEVATION } from "@/constants/Elevation";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { PLACE_HERO_TONE } from "@/constants/PlaceHero";
import { renderWithTheme } from "@/test-helpers/theme";

const SURFACE = "surface";
const highlight = () => screen.getByTestId(`${SURFACE}-highlight`, { includeHiddenElements: true });

// A resting surface separates by tone, lift and a lit top edge, never a line.
const expectResting = () => {
  const surface = screen.getByTestId(SURFACE);
  expect(surface).not.toHaveStyle({ borderTopWidth: 1 });
  expect(surface).toHaveStyle({
    backgroundColor: NEDAA_LIGHT.surfaceGlass.hex,
    boxShadow: ELEVATION.e1.boxShadow.light,
  });
  expect(highlight()).toHaveStyle({ boxShadow: `inset 0 1px 0 ${NEDAA_LIGHT.highlight.hex}` });
};

describe("Card", () => {
  it("rests on the glass tone with lift and a lit edge, no border", async () => {
    await renderWithTheme(
      <Card testID={SURFACE}>
        <Text>one</Text>
      </Card>
    );

    expectResting();
  });

  // The lit edge follows whatever corner the card is given, named or not.
  it.each([
    [24, 24],
    ["$10", 999],
  ] as const)("lights the curve of a %s corner", async (borderRadius, corner) => {
    await renderWithTheme(<Card testID={SURFACE} borderRadius={borderRadius} />);

    expect(highlight()).toHaveStyle({
      borderTopLeftRadius: corner,
      borderTopRightRadius: corner,
    });
  });

  it("pads its content by the card inset", async () => {
    await renderWithTheme(<Card testID={SURFACE} />);

    expect(screen.getByTestId(SURFACE)).toHaveStyle({ paddingTop: 16, paddingLeft: 16 });
  });

  it("rests the same way when it can be pressed", async () => {
    await renderWithTheme(<Card.Pressable testID={SURFACE} onPress={jest.fn()} />);

    expectResting();
  });

  // A sheet stacks two tones and never lays glass on glass.
  it("lies flat on the panel tone when nested in a sheet", async () => {
    await renderWithTheme(<Card testID={SURFACE} variant="panel" />);

    const surface = screen.getByTestId(SURFACE);
    expect(surface).toHaveStyle({ backgroundColor: NEDAA_LIGHT.panel.hex });
    expect(surface).not.toHaveStyle({ boxShadow: ELEVATION.e1.boxShadow.light });
    expect(
      screen.queryByTestId(`${SURFACE}-highlight`, { includeHiddenElements: true })
    ).toBeNull();
  });

  it("rules a grouped card's rows with the hairline", async () => {
    await renderWithTheme(<Card.Divider testID="divider" />);

    expect(screen.getByTestId("divider", { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: NEDAA_LIGHT.hairline.hex,
    });
  });
});

describe("ListGroup surface", () => {
  it("rests on the glass tone with lift and a lit edge, no border", async () => {
    await renderWithTheme(
      <ListGroup testID={SURFACE}>
        <Text>one</Text>
      </ListGroup>
    );

    expectResting();
  });

  it("draws the grouped card's surface", async () => {
    const GROUP = "group";
    await renderWithTheme(
      <>
        <Card testID={SURFACE} variant="grouped" />
        <ListGroup testID={GROUP}>
          <Text>one</Text>
        </ListGroup>
      </>
    );
    const look = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

    expect(look(GROUP)).toEqual(look(SURFACE));
  });

  it("rules between its rows with the hairline", async () => {
    await renderWithTheme(
      <ListGroup>
        <Text>one</Text>
        <Text>two</Text>
      </ListGroup>
    );

    expect(
      screen.getByTestId(LIST_GROUP_PART.DIVIDER, { includeHiddenElements: true })
    ).toHaveStyle({ backgroundColor: NEDAA_LIGHT.hairline.hex });
  });
});

describe("PlaceHero surface", () => {
  it("rests with the card's lift and a lit edge along its hero corners", async () => {
    await renderWithTheme(
      <PlaceHero tone={PLACE_HERO_TONE.DEVICE} kicker="A" title="B" subtitle="C" />
    );

    expect(screen.getByTestId(PLACE_HERO_PART.FRAME)).toHaveStyle({
      boxShadow: ELEVATION.e1.boxShadow.light,
    });
    expect(
      screen.getByTestId(`${PLACE_HERO_PART.FRAME}-highlight`, { includeHiddenElements: true })
    ).toHaveStyle({
      borderTopLeftRadius: 24,
      boxShadow: `inset 0 1px 0 ${NEDAA_LIGHT.highlight.hex}`,
    });
  });
});

describe("ListRow frame", () => {
  it("sets a grouped row at 56 high with a 10 by 14 inset", async () => {
    await renderWithTheme(
      <ListRow variant={LIST_ROW_VARIANT.GROUPED} title="A" onPress={jest.fn()} />
    );

    expect(screen.getByRole("button", { name: "A" })).toHaveStyle({
      minHeight: 56,
      paddingTop: 10,
      paddingLeft: 14,
    });
  });

  it("washes a pressed grouped row with the pressed tone", async () => {
    await renderWithTheme(
      <ListRow variant={LIST_ROW_VARIANT.GROUPED} title="A" onPress={jest.fn()} />
    );
    const row = screen.getByRole("button", { name: "A" });

    await act(() => fireEvent(row, "responderGrant", { nativeEvent: {} }));

    expect(screen.getByRole("button", { name: "A" })).toHaveStyle({
      opacity: 1,
      backgroundColor: NEDAA_LIGHT.pressed.hex,
    });
  });

  it("rests a standalone row like a card, with no border", async () => {
    await renderWithTheme(<ListRow title="A" onPress={jest.fn()} />);
    const row = screen.getByRole("button", { name: "A" });

    expect(row).not.toHaveStyle({ borderTopWidth: 1 });
    expect(row).toHaveStyle({
      minHeight: 56,
      backgroundColor: NEDAA_LIGHT.surfaceGlass.hex,
      boxShadow: ELEVATION.e1.boxShadow.light,
    });
  });
});

describe("ListRow text", () => {
  const rowTypes = [LIST_ROW_VARIANT.CARD, LIST_ROW_VARIANT.GROUPED];
  // A weight reaches the native text as the face that carries it.
  const face = (weight: "500" | "600") => config.fonts.body.face?.[weight]?.normal;

  it.each(rowTypes)("sets a %s row's name at 16 and 600", async (variant) => {
    await renderWithTheme(<ListRow variant={variant} title="A" status="B" onPress={jest.fn()} />);

    expect(screen.getByText("A")).toHaveStyle({ fontSize: 16, fontFamily: face("600") });
  });

  it.each(rowTypes)("sets a %s row's status at 13 and 500, muted", async (variant) => {
    await renderWithTheme(<ListRow variant={variant} title="A" status="B" onPress={jest.fn()} />);

    expect(screen.getByText("B")).toHaveStyle({
      fontSize: 13,
      fontFamily: face("500"),
      color: NEDAA_LIGHT.muted.hex,
    });
  });

  it.each(rowTypes)("draws a %s row's chevron at 0.7", async (variant) => {
    await renderWithTheme(<ListRow variant={variant} title="A" onPress={jest.fn()} />);

    expect(screen.getByTestId(LIST_ROW_PART.CHEVRON, { includeHiddenElements: true })).toHaveStyle({
      opacity: 0.7,
    });
  });

  it("sets the glyph on a 34pt tile with the chip radius", async () => {
    await renderWithTheme(<ListRow icon={AlarmClock} tile title="A" onPress={jest.fn()} />);

    expect(screen.getByTestId(ICON_TILE_ID, { includeHiddenElements: true })).toHaveStyle({
      width: 34,
      height: 34,
      borderTopLeftRadius: 8,
    });
  });
});
