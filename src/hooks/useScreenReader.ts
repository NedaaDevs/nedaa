import { AccessibilityInfo } from "react-native";

import { useAccessibilityFlag } from "@/hooks/useAccessibilityFlag";

const read = () => AccessibilityInfo.isScreenReaderEnabled();

export const useScreenReader = (): boolean => useAccessibilityFlag(read, "screenReaderChanged");
