import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

import type { A11yFlagEvent } from "@/constants/Accessibility";

/** The last value each setting reported, so a remount starts from it. */
const lastKnown = new Map<A11yFlagEvent, boolean>();

/** Reads a setting ahead of any reader, e.g. at app start. */
export const primeAccessibilityFlag = (read: () => Promise<boolean>, event: A11yFlagEvent) => {
  void read().then((value) => lastKnown.set(event, value));
};

/** An OS accessibility setting, followed so a change takes effect at once. */
export const useAccessibilityFlag = (
  read: () => Promise<boolean>,
  event: A11yFlagEvent
): boolean => {
  const [enabled, setEnabled] = useState(() => lastKnown.get(event) ?? false);

  useEffect(() => {
    let active = true;
    const learn = (value: boolean) => {
      lastKnown.set(event, value);
      if (active) setEnabled(value);
    };
    void read().then(learn);

    const subscription = AccessibilityInfo.addEventListener(event, learn);
    return () => {
      active = false;
      subscription.remove();
    };
  }, [read, event]);

  return enabled;
};
