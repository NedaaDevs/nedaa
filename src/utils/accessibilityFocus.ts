import { AccessibilityInfo, type HostInstance } from "react-native";

/** Moves screen-reader focus to a view, when there is one. */
export const focusOn = (node: HostInstance | null | undefined) => {
  if (node) AccessibilityInfo.sendAccessibilityEvent(node, "focus");
};
