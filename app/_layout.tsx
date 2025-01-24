import { Stack } from "expo-router";
import { I18nManager, Platform } from "react-native";
import RNRestart from "react-native-restart";
import * as Sentry from "@sentry/react-native";

import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

import "@/global.css";
import "@/localization/i18n";

// Services
// import { useInitialSetup } from "@/hooks/useInitialSetup";

// Stores
import { getDirection, isRTL, useAppStore } from "@/stores/app";
// import { useNotificationStore } from "@/stores/notification";

// Components
import { ToastContainer } from "@/components/toast-container";

Sentry.init({
  dsn: "",
});

export default function RootLayout() {
  const { mode, locale } = useAppStore();

  const shouldBeRTL = isRTL(getDirection(locale));
  if (shouldBeRTL !== I18nManager.isRTL && Platform.OS !== "web") {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
    I18nManager.swapLeftAndRightInRTL(shouldBeRTL);

    RNRestart.restart();
  }

  return (
    <GluestackUIProvider mode={mode}>
      <ToastContainer />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </GluestackUIProvider>
  );
}
