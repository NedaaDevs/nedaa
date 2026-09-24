import { AccessibilityInfo } from "react-native";

import { useAccessibilityFlag } from "@/hooks/useAccessibilityFlag";

const read = () => AccessibilityInfo.isReduceMotionEnabled();

export const useReducedMotion = (): boolean => useAccessibilityFlag(read, "reduceMotionChanged");
