import { useRef } from "react";
import type { ViewInstance } from "react-native";

import { focusOn } from "@/utils/accessibilityFocus";

/** Unequal to any key, so the first layout always focuses. */
const NOT_YET = Symbol("not yet focused");

/** Gives `ref`'s view reader focus at its first layout for each `key`. */
export const useLayoutFocus = (key?: unknown) => {
  const ref = useRef<ViewInstance>(null);
  const focusedFor = useRef<unknown>(NOT_YET);
  // Sent from layout: a view mounted in this commit may have no native view.
  const onLayout = () => {
    if (focusedFor.current === key) return;
    focusedFor.current = key;
    focusOn(ref.current);
  };
  return { ref, onLayout };
};
