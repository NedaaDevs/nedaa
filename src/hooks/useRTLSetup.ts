import { useEffect } from "react";
import { I18nManager, Platform } from "react-native";
// import RNRestart from "react-native-restart";

export const useRTLSetup = (shouldBeRTL: boolean) => {
  useEffect(() => {
    if (shouldBeRTL !== I18nManager.isRTL && Platform.OS !== "web") {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
      I18nManager.swapLeftAndRightInRTL(shouldBeRTL);
      // RNRestart.restart();
    }
  }, [shouldBeRTL]);
};
