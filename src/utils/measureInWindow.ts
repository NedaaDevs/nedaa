import type { View } from "react-native";

import type { WindowRect } from "@/utils/sky";

/** A view's box in window points, or null once it has unmounted. */
export const measureInWindow = (view: View | null): Promise<WindowRect | null> =>
  new Promise((resolve) => {
    if (!view) return resolve(null);
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
