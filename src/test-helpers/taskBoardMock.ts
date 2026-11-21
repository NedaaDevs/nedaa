import { createElement } from "react";
import { Pressable, Text } from "react-native";

/** A board module whose board solves at one press of "solve <name>". */
export const mockBoard = (name: string) => ({
  __esModule: true,
  default: ({ onComplete }: { onComplete: () => void }) =>
    createElement(
      Pressable,
      { accessibilityRole: "button", onPress: onComplete },
      createElement(Text, null, `solve ${name}`)
    ),
});
