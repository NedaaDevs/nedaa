import { useEffect } from "react";
import { I18nManager, Platform } from "react-native";
import * as Updates from "expo-updates";

// Enums
import { PlatformType } from "@/enums/app";

export const useRTLSetup = (shouldBeRTL: boolean) => {
  useEffect(() => {
    if (shouldBeRTL !== I18nManager.isRTL && Platform.OS !== "web") {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
      I18nManager.swapLeftAndRightInRTL(shouldBeRTL);
      if (Platform.OS === PlatformType.ANDROID) {
        Updates.reloadAsync();
      }
    }
  }, [shouldBeRTL]);
};
