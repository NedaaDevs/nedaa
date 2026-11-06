import { screen, userEvent } from "@testing-library/react-native";

import { Switch } from "@/components/ui/switch";
import { renderWithTheme } from "@/test-helpers/theme";

const LABEL = "Show seconds";

describe("Switch", () => {
  it("reaches the screen reader with its name and state", async () => {
    await renderWithTheme(
      <Switch value accessibilityLabel={LABEL} accessibilityHint="Counts to the second" />
    );

    const toggle = screen.getByRole("switch", { name: LABEL });
    expect(toggle.props.accessibilityHint).toBe("Counts to the second");
    expect(toggle).toBeChecked();
  });

  it("stays still when disabled", async () => {
    const onValueChange = jest.fn();
    await renderWithTheme(
      <Switch value={false} disabled accessibilityLabel={LABEL} onValueChange={onValueChange} />
    );

    expect(screen.getByRole("switch", { name: LABEL }).props.disabled).toBe(true);
    await userEvent.press(screen.getByRole("switch", { name: LABEL }));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
