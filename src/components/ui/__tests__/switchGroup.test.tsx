import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { screen, userEvent } from "@testing-library/react-native";
import { Bell } from "lucide-react-native";

import { ICON_SIZES } from "@/components/ui/icon/sizing";
import { SwitchGroup } from "@/components/ui/switch-group";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";

const LABEL = "Athan";
const SUMMARY = "Makkah";
const HINT = "Plays at prayer time";
const BODY = "Sound";
const NAME = `${LABEL}, ${SUMMARY}`;
const NESTED = "Vibration";

const Group = ({ initial = false }: { initial?: boolean }) => {
  const [on, setOn] = useState(initial);
  return (
    <SwitchGroup
      icon={Bell}
      label={LABEL}
      summary={SUMMARY}
      hint={HINT}
      value={on}
      onValueChange={setOn}>
      <Text>{BODY}</Text>
    </SwitchGroup>
  );
};

const row = () => screen.getByRole("switch", { name: NAME });
type Host = ReturnType<typeof row>;
const styleOf = (element: Host) => StyleSheet.flatten(element.props.style) ?? {};

describe("SwitchGroup", () => {
  it("reads as one switch with its name, summary, hint and state", async () => {
    await renderWithTheme(<Group initial />);

    expect(screen.getAllByRole("switch")).toHaveLength(1);
    expect(row()).toBeChecked();
    expect(row().props.accessibilityHint).toBe(HINT);
  });

  it("reads its label alone when it has no summary", async () => {
    await renderWithTheme(<SwitchGroup label={LABEL} value={false} onValueChange={jest.fn()} />);

    expect(screen.getByRole("switch", { name: LABEL })).not.toBeChecked();
  });

  it("toggles when the row is pressed", async () => {
    const onValueChange = jest.fn();
    await renderWithTheme(
      <SwitchGroup label={LABEL} summary={SUMMARY} value={false} onValueChange={onValueChange} />
    );

    await userEvent.setup().press(row());

    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it("reads busy and ignores presses while busy", async () => {
    const onValueChange = jest.fn();
    await renderWithTheme(
      <SwitchGroup
        label={LABEL}
        summary={SUMMARY}
        value={false}
        busy
        onValueChange={onValueChange}
      />
    );

    expect(row().props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    await userEvent.setup().press(row());
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("shows its body only while the switch is on", async () => {
    await renderWithTheme(<Group />);
    expect(screen.queryByText(BODY)).toBeNull();

    await userEvent.setup().press(row());
    expect(row()).toBeChecked();
    expect(screen.getByText(BODY)).toBeOnTheScreen();

    await userEvent.setup().press(row());
    expect(screen.queryByText(BODY)).toBeNull();
  });

  it("keeps the row at the touch floor with a role and a name", async () => {
    await renderWithTheme(<Group initial />);

    expect(row()).toHaveStyle({ minHeight: 44 });
    expect(controlProblems()).toEqual([]);
  });

  it("draws a divider under a group", async () => {
    await renderWithTheme(<Group initial />);

    expect(styleOf(row().parent!)).toMatchObject({ borderBottomWidth: 1 });
  });

  // The icon's width plus the row's gap, so the body lines up under the label.
  it("starts its body where the label starts", async () => {
    await renderWithTheme(<Group initial />);

    const body = screen.getByText(BODY).parent!.parent!;
    const [spacer] = body.children as Host[];
    expect(styleOf(body).gap).toBe(styleOf(row()).gap);
    expect(styleOf(spacer!).width).toBe(ICON_SIZES.md);
  });

  // A switch inside a group is a setting of it, not a second group header.
  it("draws a nested switch as a plain row", async () => {
    await renderWithTheme(
      <SwitchGroup icon={Bell} label={LABEL} summary={SUMMARY} value onValueChange={jest.fn()}>
        <SwitchGroup label={NESTED} value={false} onValueChange={jest.fn()} />
      </SwitchGroup>
    );

    const nested = screen.getByRole("switch", { name: NESTED });
    expect(styleOf(nested.parent!).borderBottomWidth).toBeUndefined();
    expect(styleOf(screen.getByText(NESTED)).fontFamily).not.toBe(
      styleOf(screen.getByText(LABEL)).fontFamily
    );
  });
});
