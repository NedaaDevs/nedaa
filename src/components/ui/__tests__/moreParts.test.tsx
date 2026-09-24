import { Text } from "react-native";
import { screen, userEvent } from "@testing-library/react-native";
import { AlarmClock, Compass } from "lucide-react-native";

import { ListRow } from "@/components/ui/list-row";
import { METER_PART, Meter } from "@/components/ui/meter";
import { Section } from "@/components/ui/section";
import { Tile } from "@/components/ui/tile";
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
