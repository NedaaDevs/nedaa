import { AccessibilityInfo } from "react-native";

import { primeAccessibilityFlag, useAccessibilityFlag } from "@/hooks/useAccessibilityFlag";

const read = () => AccessibilityInfo.isReduceMotionEnabled();
const EVENT = "reduceMotionChanged";

// Known before the first screen mounts, so no first frame animates by mistake.
primeAccessibilityFlag(read, EVENT);

export const useReducedMotion = (): boolean => useAccessibilityFlag(read, EVENT);
