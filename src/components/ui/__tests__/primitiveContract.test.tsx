import { screen, userEvent } from "@testing-library/react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pressable } from "@/components/ui/pressable";
import { renderWithTheme } from "@/test-helpers/theme";

/** The platform touch floor, in points. A smaller control is hard to hit. */
const TOUCH_FLOOR = 44;

describe("primitive accessibility contract", () => {
  it("a tappable card announces itself as a button", async () => {
    await renderWithTheme(<Card.Pressable accessibilityLabel="Open settings" onPress={() => {}} />);

    expect(screen.getByRole("button", { name: "Open settings" })).toBeOnTheScreen();
  });

  const FRAMES = [
    ["Pressable", Pressable],
    ["Card.Pressable", Card.Pressable],
  ] as const;

  it.each(FRAMES)("a disabled %s reports it rather than only dimming", async (_, Frame) => {
    await renderWithTheme(<Frame accessibilityLabel="Reset" disabled onPress={() => {}} />);

    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  it.each(FRAMES)("a %s fires when a finger presses it", async (_, Frame) => {
    const onPress = jest.fn();
    await renderWithTheme(<Frame accessibilityLabel="Open" onPress={onPress} />);

    await userEvent.setup().press(screen.getByRole("button", { name: "Open" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // One element hides what it holds from VoiceOver, so a container opts out.
  it.each(FRAMES)("a %s holding a control can stop being one element", async (_, Frame) => {
    await renderWithTheme(<Frame testID="container" accessible={false} onPress={() => {}} />);

    expect(screen.getByTestId("container", { includeHiddenElements: true })).toHaveProp(
      "accessible",
      false
    );
  });

  // The frames default to a button; a radio or a link must still read as one.
  it.each(FRAMES)("a %s keeps the role its caller names", async (_, Frame) => {
    await renderWithTheme(
      <Frame accessibilityRole="radio" accessibilityLabel="Fajr" onPress={() => {}} />
    );

    expect(screen.getByRole("radio", { name: "Fajr" })).toBeOnTheScreen();
  });

  it("a button is one element the screen reader can find", async () => {
    await renderWithTheme(
      <Button onPress={() => {}}>
        <Button.Text>Retry</Button.Text>
      </Button>
    );

    expect(screen.getByRole("button", { name: "Retry" })).toBeOnTheScreen();
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
