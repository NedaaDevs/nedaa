import { createElement, Fragment } from "react";
import { Pressable, Text } from "react-native";

import type { BoardProps } from "@/components/alarm/challenges/taskBoards";

/** A board module whose board solves at one press of "solve <name>". */
export const mockBoard = (name: string) => ({
  __esModule: true,
  // Draws any opening line it is handed, so a test can find it.
  default: ({ onComplete, opening, drawn = [], onDraw }: BoardProps) =>
    createElement(
      Fragment,
      null,
      createElement(
        Pressable,
        { accessibilityRole: "button", onPress: onComplete },
        createElement(Text, null, `solve ${name}`),
        opening ? createElement(Text, null, `${name} opens: ${opening}`) : null
      ),
      // "draw <name>" adds the next item to the run's memory, shown beside it.
      onDraw
        ? createElement(
            Pressable,
            { accessibilityRole: "button", onPress: () => onDraw(drawn.length) },
            createElement(Text, null, `draw ${name}`)
          )
        : null,
      drawn.length > 0 ? createElement(Text, null, `${name} drew ${drawn.join(",")}`) : null
    ),
});
