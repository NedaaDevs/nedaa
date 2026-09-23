import { screen, userEvent } from "@testing-library/react-native";

import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { renderWithTheme } from "@/test-helpers/theme";

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

describe("disabled pressables", () => {
  // userEvent drives the host view's responder, as a finger does; fireEvent would
  // read the handler off the wrapper's props and miss what reaches the view.
  it.each([
    ["Pressable", Pressable],
    ["Card.Pressable", Card.Pressable],
  ])("%s ignores press-in and press-out", async (_, Component) => {
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    await renderWithTheme(
      <Component accessibilityLabel="Hold" disabled onPressIn={onPressIn} onPressOut={onPressOut} />
    );

    await userEvent.setup().press(screen.getByRole("button", { name: "Hold" }));

    expect(onPressIn).not.toHaveBeenCalled();
    expect(onPressOut).not.toHaveBeenCalled();
  });
});
