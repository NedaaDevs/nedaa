import { useEffect } from "react";
import { I18nManager, Platform } from "react-native";
import * as Updates from "expo-updates";

export const useRTLSetup = (shouldBeRTL: boolean) => {
  useEffect(() => {
    if (shouldBeRTL !== I18nManager.isRTL && Platform.OS !== "web") {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
      I18nManager.swapLeftAndRightInRTL(shouldBeRTL);
      Updates.reloadAsync();
    }
  }, [shouldBeRTL]);
};
