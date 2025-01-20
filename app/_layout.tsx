import { Stack } from "expo-router";
import * as Updates from "expo-updates";
import { I18nManager, Platform } from "react-native";

import { getDirection, isRTL, useAppStore } from "@/stores/app";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

import "@/global.css";
import "@/localization/i18n";

export default function RootLayout() {
  const { mode, locale } = useAppStore();

  const shouldBeRTL = isRTL(getDirection(locale));
  if (shouldBeRTL !== I18nManager.isRTL && Platform.OS !== "web") {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
    I18nManager.swapLeftAndRightInRTL(shouldBeRTL);

    (async function () {
      await Updates.reloadAsync();
    })();
  }

  return (
    <GluestackUIProvider mode={mode}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </GluestackUIProvider>
  );
}
