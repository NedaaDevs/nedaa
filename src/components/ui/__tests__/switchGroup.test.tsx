import { useState } from "react";
import { Text } from "react-native";
import { screen, userEvent } from "@testing-library/react-native";
import { Bell } from "lucide-react-native";

import { SwitchGroup } from "@/components/ui/switch-group";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";

const LABEL = "Athan";
const SUMMARY = "Makkah";
const HINT = "Plays at prayer time";
const BODY = "Sound";
const NAME = `${LABEL}, ${SUMMARY}`;

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
});
