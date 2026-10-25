import { Text } from "react-native";
import { screen, userEvent } from "@testing-library/react-native";
import { AlarmClock, Compass } from "lucide-react-native";

import { ICON_TILE_ID } from "@/components/ui/icon-tile";
import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { METER_PART, Meter } from "@/components/ui/meter";
import { SECTION_LABEL_INK, SECTION_PART, Section } from "@/components/ui/section";
import { Text as AppText } from "@/components/ui/text";
import { Tile } from "@/components/ui/tile";
import { ELEVATION } from "@/constants/Elevation";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { SECTION_KIND } from "@/constants/Section";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { fontSizeOf, styleOf } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";

describe("Section", () => {
  it("names its group with a header", async () => {
    await renderWithTheme(
      <Section title="Tools">
        <Text>inside</Text>
      </Section>
    );

    expect(screen.getByRole("header", { name: "Tools" })).toBeTruthy();
    expect(screen.getByText("inside")).toBeTruthy();
  });

  it("sets an accessory beside its title, outside the header", async () => {
    await renderWithTheme(
      <Section title="Playback" accessory={<Text>Global</Text>}>
        <Text>inside</Text>
      </Section>
    );

    expect(screen.getByRole("header", { name: "Playback" })).toBeTruthy();
    expect(screen.getByText("Global")).toBeTruthy();
  });

  // A screen's group reads as a title; a sheet's section as a quiet label.
  it("titles a screen's group in the full ink at the lg size", async () => {
    await renderWithTheme(<Section title="Tools">{null}</Section>);
    const header = screen.getByRole("header", { name: "Tools" });

    expect(header).toHaveStyle({ color: NEDAA_LIGHT.fg.hex, fontSize: fontSizeOf("lg") });
  });

  // A label is ink set back to 78%, not a muted caption, at 15/600.
  it("labels a section in the ink at 78%, at the label size and 600", async () => {
    await renderWithTheme(
      <>
        <Section title="Alerts" kind={SECTION_KIND.LABEL}>
          {null}
        </Section>
        <AppText size="label" fontWeight="600">
          reference
        </AppText>
      </>
    );
    const header = screen.getByRole("header", { name: "Alerts" });

    expect(header).toHaveStyle({
      color: NEDAA_LIGHT.fg.hex,
      opacity: SECTION_LABEL_INK,
      fontSize: fontSizeOf("label"),
      fontFamily: styleOf(screen.getByText("reference")).fontFamily,
    });
  });

  // The label sits 10 above its group and 4 in from the group's edge.
  it("spaces a label 10 above its group, inset 4 at both ends", async () => {
    await renderWithTheme(
      <Section title="Alerts" kind={SECTION_KIND.LABEL}>
        <Text>inside</Text>
      </Section>
    );

    expect(styleOf(screen.getByTestId(SECTION_PART.HEAD))).toMatchObject({
      paddingLeft: 4,
      paddingRight: 4,
    });
    expect(styleOf(screen.getByTestId(SECTION_PART.FRAME))).toMatchObject({ gap: 10 });
  });
});

describe("ListRow", () => {
  // The status is live state; the reader hears it with the name, then the hint.
  it("reads its name and status as one button, and opens", async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <ListRow
        icon={AlarmClock}
        title="Alarms"
        status="Fajr on"
        hint="Opens alarms"
        onPress={onPress}
      />
    );

    const row = screen.getByRole("button", { name: "Alarms, Fajr on" });
    expect(row.props.accessibilityHint).toBe("Opens alarms");
    await userEvent.press(row);
    expect(onPress).toHaveBeenCalled();
  });

  it("stands alone as a resting card by default", async () => {
    await renderWithTheme(<ListRow icon={AlarmClock} title="A" status="B" onPress={jest.fn()} />);

    const row = screen.getByRole("button", { name: "A, B" });
    expect(row).not.toHaveStyle({ borderTopWidth: 1 });
    expect(row).toHaveStyle({
      backgroundColor: NEDAA_LIGHT.surfaceGlass.hex,
      boxShadow: ELEVATION.e1.boxShadow.light,
    });
  });

  // Inside a panel the panel draws the edge; a second border would nest cards.
  it("lies flat with no icon as a plain row", async () => {
    await renderWithTheme(
      <ListRow variant={LIST_ROW_VARIANT.PLAIN} title="A" status="B" onPress={jest.fn()} />
    );

    const row = screen.getByRole("button", { name: "A, B" });
    expect(row).not.toHaveStyle({ borderTopWidth: 1 });
    expect(row).toHaveStyle({ backgroundColor: "transparent" });
  });
});

// A live value stays on one line; a row's explanation is read in full.
describe("ListRow status lines", () => {
  const NOTE = "We ask for location access if you haven't given it.";

  it("keeps a live status to one line", async () => {
    await renderWithTheme(<ListRow title="Refresh" status="12 minutes ago" onPress={jest.fn()} />);

    expect(screen.getByText("12 minutes ago").props.numberOfLines).toBe(1);
  });

  it("wraps a status that explains the row", async () => {
    await renderWithTheme(
      <ListRow title="Automatic location" status={NOTE} wrapStatus onPress={jest.fn()} />
    );

    expect(screen.getByText(NOTE).props.numberOfLines).toBeUndefined();
  });
});

describe("ListRow icon", () => {
  // Settings rows mark their icon with a tinted tile; More keeps it bare.
  it("sets the icon on the tinted tile when asked", async () => {
    await renderWithTheme(<ListRow icon={AlarmClock} tile title="A" onPress={jest.fn()} />);

    expect(screen.getByTestId(ICON_TILE_ID, { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: NEDAA_LIGHT.tile.hex,
    });
  });

  it("leaves the icon bare by default", async () => {
    await renderWithTheme(<ListRow icon={AlarmClock} title="A" onPress={jest.fn()} />);

    expect(screen.queryByTestId(ICON_TILE_ID, { includeHiddenElements: true })).toBeNull();
  });
});

describe("ListRow label", () => {
  // A row with no live state reads as its name alone, with no stray comma.
  it("reads the name alone when it has no status", async () => {
    await renderWithTheme(<ListRow title="Diagnostics" onPress={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Diagnostics" })).toBeTruthy();
  });

  it("joins name and status with the locale's comma", async () => {
    await i18n.changeLanguage(AppLocale.AR);
    try {
      await renderWithTheme(<ListRow title="أ" status="ب" onPress={jest.fn()} />);

      expect(screen.getByRole("button", { name: "أ، ب" })).toBeTruthy();
    } finally {
      await i18n.changeLanguage(AppLocale.EN);
    }
  });
});

describe("ListRow trailing chevron", () => {
  const chevronPath = () =>
    JSON.stringify(screen.toJSON()).match(/"d":"(m\d+ 18-6-6 6-6|m9 18 6-6-6-6)"/)?.[1];

  // Onward points to the end edge: right in English, left in Arabic.
  it("points right when read left to right", async () => {
    await renderWithTheme(<ListRow title="A" onPress={jest.fn()} />);

    expect(chevronPath()).toBe("m9 18 6-6-6-6");
  });

  it("points left when read right to left", async () => {
    await renderWithTheme(<ListRow title="A" onPress={jest.fn()} />, { isRTL: true });

    expect(chevronPath()).toBe("m15 18-6-6 6-6");
  });
});

describe("ListRow grouped", () => {
  // Inside a list group the group draws the edge and the rules between rows.
  it("lies flat, with the name at the lg size", async () => {
    await renderWithTheme(
      <ListRow variant={LIST_ROW_VARIANT.GROUPED} title="Privacy" status="B" onPress={jest.fn()} />
    );

    const row = screen.getByRole("button", { name: "Privacy, B" });
    expect(row).not.toHaveStyle({ borderTopWidth: 1 });
    expect(row).toHaveStyle({ backgroundColor: "transparent" });
    expect(screen.getByText("Privacy")).toHaveStyle({ fontSize: fontSizeOf("lg") });
    expect(screen.getByText("B")).toHaveStyle({ fontSize: fontSizeOf("helper") });
  });
});

describe("ListRow test id", () => {
  it("carries the test id its host names on the row a flow presses", async () => {
    const onPress = jest.fn();
    await renderWithTheme(<ListRow title="A" testID="row-a" onPress={onPress} />);

    await userEvent.press(screen.getByTestId("row-a"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("ListRow static", () => {
  const LONG = "A statement long enough to wrap onto a second and a third line on a phone.";

  // A statement of fact: nothing to press, so no button and no chevron.
  it("is no button and draws no chevron when it has no action", async () => {
    await renderWithTheme(
      <ListRow variant={LIST_ROW_VARIANT.GROUPED} icon={AlarmClock} tile title="A" status={LONG} />
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/m9 18 6-6-6-6/);
  });

  it("heads its text with the title, so a reader can jump to it", async () => {
    await renderWithTheme(<ListRow variant={LIST_ROW_VARIANT.GROUPED} title="A" status={LONG} />);

    expect(screen.getByRole("header", { name: "A" })).toBeTruthy();
  });

  it("shows the body in full", async () => {
    await renderWithTheme(<ListRow variant={LIST_ROW_VARIANT.GROUPED} title="A" status={LONG} />);

    expect(screen.getByText(LONG).props.numberOfLines).toBeUndefined();
  });

  it("keeps the grouped type sizes", async () => {
    await renderWithTheme(<ListRow variant={LIST_ROW_VARIANT.GROUPED} title="A" status={LONG} />);

    expect(screen.getByText("A")).toHaveStyle({ fontSize: fontSizeOf("lg") });
    expect(screen.getByText(LONG)).toHaveStyle({ fontSize: fontSizeOf("helper") });
  });
});

describe("ListRow chevron weight", () => {
  // The grouped chevron matches the tile glyph; More keeps the default.
  it("draws the grouped chevron at 1.75", async () => {
    await renderWithTheme(
      <ListRow variant={LIST_ROW_VARIANT.GROUPED} title="A" onPress={jest.fn()} />
    );

    expect(screen.getByRole("button", { name: "A" })).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toMatch(/"strokeWidth":1\.75/);
  });

  it("leaves the card chevron at the default weight", async () => {
    await renderWithTheme(<ListRow title="A" onPress={jest.fn()} />);

    expect(JSON.stringify(screen.toJSON())).not.toMatch(/"strokeWidth":1\.75/);
  });
});

describe("Tile", () => {
  it("is a button named by its label", async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Tile icon={Compass} label="Qibla" onPress={onPress} />);

    await userEvent.press(screen.getByRole("button", { name: "Qibla" }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe("Tile layout", () => {
  // Icon at the top start, name at the bottom start: the reading edge.
  it("sets the name at the bottom start, under the icon", async () => {
    await renderWithTheme(<Tile icon={Compass} label="Qibla" onPress={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Qibla" })).toHaveStyle({
      flexDirection: "column",
      alignItems: "flex-start",
      justifyContent: "space-between",
    });
  });
});

describe("Meter", () => {
  // A bar alone is colour; the reader gets the numbers.
  it("reports its value to the screen reader", async () => {
    await renderWithTheme(<Meter value={5} max={7} label="Umrah progress" />);

    const meter = screen.getByRole("progressbar", { name: "Umrah progress" });
    expect(meter.props.accessibilityValue).toEqual({ min: 0, max: 7, now: 5 });
  });

  it("fills its share of the track", async () => {
    await renderWithTheme(<Meter value={5} max={7} label="Umrah progress" />);

    expect(screen.getByTestId(METER_PART.FILL, { includeHiddenElements: true })).toHaveStyle({
      width: `${(5 / 7) * 100}%`,
    });
  });
});
