import { use } from "react";
import { useIsFocused } from "expo-router";

import { AppHiddenContext } from "@/contexts/AppHiddenContext";

/** Whether a screen's live work runs: in focus, and not hidden. */
export const useScreenLive = (): boolean => {
  const focused = useIsFocused();
  const hidden = use(AppHiddenContext);
  return focused && !hidden;
};
