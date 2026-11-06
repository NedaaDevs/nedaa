import { useState, useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";

import { APP_STATE } from "@/constants/AppState";

/** Whether the app is in front, and when it last returned to the front. */
export const useAppVisibility = () => {
  const [isActive, setIsActive] = useState(AppState.currentState === APP_STATE.ACTIVE);
  // 0 until the first return, so an effect keyed on it skips the mount.
  const [becameActiveAt, setBecameActiveAt] = useState(0);

  useEffect(() => {
    // A local, not React state: two changes in one batch must both count.
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (
        (previous === APP_STATE.INACTIVE || previous === APP_STATE.BACKGROUND) &&
        next === APP_STATE.ACTIVE
      ) {
        setIsActive(true);
        setBecameActiveAt(Date.now());
      } else if (next === APP_STATE.INACTIVE || next === APP_STATE.BACKGROUND) {
        setIsActive(false);
      }
      previous = next;
    });
    return () => subscription.remove();
  }, []);

  return { isActive, becameActiveAt };
};
