import { useEffect, useRef, type RefObject } from "react";
import type { ViewInstance } from "react-native";

import { focusOn } from "@/utils/accessibilityFocus";

/** Moves reader focus to `target` on a view change; null is still arriving. */
export const useViewFocus = <T>(view: T | null, target: RefObject<ViewInstance | null>) => {
  // The flow focuses the arrival, so the first view after a null moves nothing.
  const focused = useRef(view);
  useEffect(() => {
    if (focused.current === view) return;
    const arriving = focused.current === null;
    focused.current = view;
    if (!arriving) focusOn(target.current);
  }, [view, target]);
};
