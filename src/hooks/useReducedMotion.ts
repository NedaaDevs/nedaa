import { AccessibilityInfo } from "react-native";

import { A11Y_FLAG_EVENT } from "@/constants/Accessibility";
import { primeAccessibilityFlag, useAccessibilityFlag } from "@/hooks/useAccessibilityFlag";

const read = () => AccessibilityInfo.isReduceMotionEnabled();

// Known before the first screen mounts, so no first frame animates by mistake.
primeAccessibilityFlag(read, A11Y_FLAG_EVENT.REDUCE_MOTION);

export const useReducedMotion = (): boolean =>
  useAccessibilityFlag(read, A11Y_FLAG_EVENT.REDUCE_MOTION);
