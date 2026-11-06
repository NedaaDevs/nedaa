import { AccessibilityInfo, Platform } from "react-native";

import { A11Y_FLAG_EVENT } from "@/constants/Accessibility";
import { PlatformType } from "@/enums/app";
import { primeAccessibilityFlag, useAccessibilityFlag } from "@/hooks/useAccessibilityFlag";

const read = () => AccessibilityInfo.isReduceTransparencyEnabled();

// Read at import, so the setting is usually known before the first screen.
if (Platform.OS === PlatformType.IOS) {
  primeAccessibilityFlag(read, A11Y_FLAG_EVENT.REDUCE_TRANSPARENCY);
}

/** The iOS Reduce Transparency setting; Android has no such setting. */
export const useReduceTransparency = (): boolean => {
  const enabled = useAccessibilityFlag(read, A11Y_FLAG_EVENT.REDUCE_TRANSPARENCY);
  return Platform.OS === PlatformType.IOS && enabled;
};
