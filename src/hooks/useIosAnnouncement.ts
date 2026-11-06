import { useEffect } from "react";
import { AccessibilityInfo, Platform } from "react-native";

import { PlatformType } from "@/enums/app";

/** How many mounted callers hold each message said; one says it for all. */
const held = new Map<string, number>();

/** Says `message` on iOS as it changes; Android reads a live region. */
export const useIosAnnouncement = (message: string | null) => {
  useEffect(() => {
    if (!message || Platform.OS !== PlatformType.IOS) return;
    const holders = held.get(message) ?? 0;
    if (holders === 0) AccessibilityInfo.announceForAccessibility(message);
    held.set(message, holders + 1);
    return () => {
      const left = (held.get(message) ?? 1) - 1;
      if (left > 0) held.set(message, left);
      else held.delete(message);
    };
  }, [message]);
};
