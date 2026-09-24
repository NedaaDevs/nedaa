import { useEffect, useState } from "react";
import { AccessibilityInfo, type AccessibilityChangeEventName } from "react-native";

/** An OS accessibility setting, followed so a change takes effect at once. */
export const useAccessibilityFlag = (
  read: () => Promise<boolean>,
  event: AccessibilityChangeEventName
): boolean => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    void read().then((value) => {
      if (active) setEnabled(value);
    });

    const subscription = AccessibilityInfo.addEventListener(event, setEnabled);
    return () => {
      active = false;
      subscription.remove();
    };
  }, [read, event]);

  return enabled;
};
