import { useState, useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";

export const useAppVisibility = () => {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [isActive, setIsActive] = useState(true);
  const [becameActiveAt, setBecameActiveAt] = useState(Date.now());

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if ((appState === "inactive" || appState === "background") && nextAppState === "active") {
        setIsActive(true);
        setBecameActiveAt(Date.now());
      } else if (nextAppState === "inactive" || nextAppState === "background") {
        setIsActive(false);
      }
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [appState]);

  return { isActive, becameActiveAt };
};
