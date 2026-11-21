import { AccessibilityInfo } from "react-native";

import { A11Y_FLAG_EVENT } from "@/constants/Accessibility";
import { primeAccessibilityFlag, useAccessibilityFlag } from "@/hooks/useAccessibilityFlag";

const read = () => AccessibilityInfo.isScreenReaderEnabled();

// Known before a task opens, so its first quiet time is the right length.
primeAccessibilityFlag(read, A11Y_FLAG_EVENT.SCREEN_READER);

export const useScreenReader = (): boolean =>
  useAccessibilityFlag(read, A11Y_FLAG_EVENT.SCREEN_READER);
