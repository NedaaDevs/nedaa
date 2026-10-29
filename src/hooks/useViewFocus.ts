import { useEffect, useRef } from "react";

/** Calls `focus` on a view change; null is still arriving. */
export const useViewFocus = <T>(view: T | null, focus: () => void) => {
  // The flow focuses the arrival, so the first view after a null moves nothing.
  const focused = useRef(view);
  useEffect(() => {
    if (focused.current === view) return;
    const arriving = focused.current === null;
    focused.current = view;
    if (!arriving) focus();
  }, [view, focus]);
};
