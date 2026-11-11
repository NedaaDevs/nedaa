import { screen, userEvent } from "@testing-library/react-native";

import { Button } from "@/components/ui/button";
import { renderWithTheme } from "@/test-helpers/theme";

describe("A disabled Button", () => {
  it("tells the screen reader it is disabled", async () => {
    await renderWithTheme(
      <Button disabled onPress={jest.fn()}>
        <Button.Text>Save</Button.Text>
      </Button>
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("ignores a press", async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <Button disabled onPress={onPress}>
        <Button.Text>Save</Button.Text>
      </Button>
    );

    await userEvent.press(screen.getByRole("button", { name: "Save" }));

    expect(onPress).not.toHaveBeenCalled();
  });

  it("stays enabled by default", async () => {
    await renderWithTheme(
      <Button onPress={jest.fn()}>
        <Button.Text>Save</Button.Text>
      </Button>
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });
});
