import { Pressable as RNPressable, Text } from "react-native";

import { Pressable } from "@/components/ui/pressable";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";

describe("controlProblems", () => {
  it("passes a named button at the platform floor", async () => {
    await renderWithTheme(<Pressable accessibilityLabel="Open" onPress={jest.fn()} />);

    expect(controlProblems()).toEqual([]);
  });

  it("reports a control with no role, no name and a small target", async () => {
    await renderWithTheme(
      <RNPressable onPress={jest.fn()} style={{ height: 20 }}>
        <Text>Open</Text>
      </RNPressable>
    );

    expect(controlProblems()).toEqual(["(unnamed): no role, no label, under 44pt"]);
  });

  it("counts an invisible touch area toward the target", async () => {
    await renderWithTheme(
      <RNPressable
        accessibilityRole="button"
        accessibilityLabel="Open"
        onPress={jest.fn()}
        hitSlop={{ top: 2, bottom: 2 }}
        style={{ minHeight: 40 }}
      />
    );

    expect(controlProblems()).toEqual([]);
  });

  it("skips controls hidden from the screen reader", async () => {
    await renderWithTheme(
      <RNPressable accessibilityElementsHidden onPress={jest.fn()} style={{ height: 20 }} />
    );

    expect(controlProblems()).toEqual([]);
  });
});
