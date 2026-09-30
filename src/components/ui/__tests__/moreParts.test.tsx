import { Text } from "react-native";
import { screen, userEvent } from "@testing-library/react-native";
import { AlarmClock, Compass } from "lucide-react-native";

import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { METER_PART, Meter } from "@/components/ui/meter";
import { Section } from "@/components/ui/section";
import { Tile } from "@/components/ui/tile";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { SECTION_KIND } from "@/constants/Section";
import { fontSizeOf } from "@/test-helpers/text";
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

  it("labels a sheet's section in the muted ink at the sm size", async () => {
    await renderWithTheme(
      <Section title="Alerts" kind={SECTION_KIND.LABEL}>
        {null}
      </Section>
    );
    const header = screen.getByRole("header", { name: "Alerts" });

    expect(header).toHaveStyle({ color: NEDAA_LIGHT.muted.hex, fontSize: fontSizeOf("sm") });
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

  it("stands alone as a bordered card by default", async () => {
    await renderWithTheme(<ListRow icon={AlarmClock} title="A" status="B" onPress={jest.fn()} />);

    expect(screen.getByRole("button", { name: "A, B" })).toHaveStyle({ borderTopWidth: 1 });
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
