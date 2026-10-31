import { createRef, type RefObject } from "react";
import type { ViewInstance } from "react-native";

import { focusOn } from "@/utils/accessibilityFocus";

/** A view's reader focus, sent once the view is laid out. */
export type LayoutFocus = {
  ref: RefObject<ViewInstance | null>;
  /** The view's own layout; a focus waiting for it goes now. */
  onLayout: () => void;
  /** Focuses the view now if it is laid out, or else at its first layout. */
  focus: () => void;
};

// A laid-out view has a native view; one mounted in this commit may not.
export const layoutFocus = (): LayoutFocus => {
  const ref = createRef<ViewInstance>();
  let laidOut: ViewInstance | null = null;
  let waiting = false;
  return {
    ref,
    onLayout: () => {
      laidOut = ref.current;
      if (!waiting) return;
      waiting = false;
      focusOn(ref.current);
    },
    focus: () => {
      waiting = ref.current === null || ref.current !== laidOut;
      if (!waiting) focusOn(ref.current);
    },
  };
};
