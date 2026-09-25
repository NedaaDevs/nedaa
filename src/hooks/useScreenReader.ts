import { AccessibilityInfo } from "react-native";

import { A11Y_FLAG_EVENT } from "@/constants/Accessibility";
import { useAccessibilityFlag } from "@/hooks/useAccessibilityFlag";

const read = () => AccessibilityInfo.isScreenReaderEnabled();

export const useScreenReader = (): boolean =>
  useAccessibilityFlag(read, A11Y_FLAG_EVENT.SCREEN_READER);
