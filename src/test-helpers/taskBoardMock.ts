import { createElement } from "react";
import { Pressable, Text } from "react-native";

import type { BoardProps } from "@/components/alarm/challenges/taskBoards";

/** A board module whose board solves at one press of "solve <name>". */
export const mockBoard = (name: string) => ({
  __esModule: true,
  // Draws any opening line it is handed, so a test can find it.
  default: ({ onComplete, opening }: BoardProps) =>
    createElement(
      Pressable,
      { accessibilityRole: "button", onPress: onComplete },
      createElement(Text, null, `solve ${name}`),
      opening ? createElement(Text, null, `${name} opens: ${opening}`) : null
    ),
});
