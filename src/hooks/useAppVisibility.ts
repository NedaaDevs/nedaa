import { useState, useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";

// Reports whether the app is foregrounded, and a timestamp that changes on every
// background→active return — screens key effects on `becameActiveAt` to re-check
// external state (permissions, battery exemption) after the user visits Settings.
//
// One stable subscription with the previous state held in a local, NOT React state:
// deciding transitions from re-subscribed closures misses the return whenever
// background→active land in one React batch (quick system-dialog dismiss, queued
// event burst on resume).
export const useAppVisibility = () => {
  const [isActive, setIsActive] = useState(AppState.currentState === "active");
  // 0 until the first foreground return — consumers key effects on changes only.
  const [becameActiveAt, setBecameActiveAt] = useState(0);

  useEffect(() => {
    let previous: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      if ((previous === "inactive" || previous === "background") && next === "active") {
        setIsActive(true);
        setBecameActiveAt(Date.now());
      } else if (next === "inactive" || next === "background") {
        setIsActive(false);
      }
      previous = next;
    });
    return () => subscription.remove();
  }, []);

  return { isActive, becameActiveAt };
};
