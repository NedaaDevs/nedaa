import { Button } from "@/components/ui/button";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";

const SIZES = ["xs", "sm", "md", "lg", "xl"] as const;

describe("Button target", () => {
  // Small sizes stay small to the eye; their touch area reaches the floor.
  it.each(SIZES)("reaches 44pt to the touch at size %s", async (size) => {
    await renderWithTheme(
      <Button size={size} accessibilityLabel="Save" onPress={jest.fn()}>
        <Button.Text>Save</Button.Text>
      </Button>
    );

    expect(controlProblems()).toEqual([]);
  });
});
