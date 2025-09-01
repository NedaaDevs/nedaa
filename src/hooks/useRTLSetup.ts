import { useEffect, useRef } from "react";
import { I18nManager, Platform } from "react-native";
import * as Updates from "expo-updates";

export const useRTLSetup = (shouldBeRTL: boolean) => {
  const mountedRef = useRef(false);

  useEffect(() => {
    // Only check for RTL changes after first mount to avoid initial reload
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    if (shouldBeRTL !== I18nManager.isRTL && Platform.OS !== "web") {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
      I18nManager.swapLeftAndRightInRTL(shouldBeRTL);

      // Trigger reload for RTL changes
      Updates.reloadAsync();
    }
  }, [shouldBeRTL]);
};
