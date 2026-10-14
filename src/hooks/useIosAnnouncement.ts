import { useEffect } from "react";
import { AccessibilityInfo, Platform } from "react-native";

import { PlatformType } from "@/enums/app";

/** Says `message` on iOS as it changes; Android reads a live region. */
export const useIosAnnouncement = (message: string | null) => {
  useEffect(() => {
    if (message && Platform.OS === PlatformType.IOS) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);
};
