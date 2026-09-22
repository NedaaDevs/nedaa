import { render, screen } from "@testing-library/react-native";
import { TamaguiProvider } from "tamagui";

import config from "../../../../tamagui.config";
import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";

const renderWithTheme = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }) => (
      <TamaguiProvider config={config} defaultTheme="light">
        {children}
      </TamaguiProvider>
    ),
  });

/** CLAUDE.md's floor. A control below it is hard to hit and fails the checklist. */
const TOUCH_FLOOR = 44;

describe("primitive accessibility contract", () => {
  it("a tappable card announces itself as a button", async () => {
    await renderWithTheme(<Card.Pressable accessibilityLabel="Open settings" onPress={() => {}} />);

    expect(screen.getByRole("button", { name: "Open settings" })).toBeOnTheScreen();
  });

  it("a disabled card reports it rather than only dimming", async () => {
    await renderWithTheme(
      <Card.Pressable accessibilityLabel="Reset" disabled onPress={() => {}} />
    );

    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  it("a pressable holds the touch floor", async () => {
    await renderWithTheme(<Pressable accessibilityLabel="Tap me" onPress={() => {}} />);

    expect(screen.getByRole("button", { name: "Tap me" })).toHaveStyle({
      minHeight: TOUCH_FLOOR,
      minWidth: TOUCH_FLOOR,
    });
  });

  it("the tab target sits above the floor", async () => {
    await renderWithTheme(
      <Pressable accessibilityLabel="Athkar" target="tab" onPress={() => {}} />
    );

    expect(screen.getByRole("button", { name: "Athkar" })).toHaveStyle({ minHeight: 50 });
  });
});
