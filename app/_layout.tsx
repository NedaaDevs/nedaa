import { Stack } from "expo-router";
import { I18nManager, Platform } from "react-native";
import RNRestart from "react-native-restart";
import * as Sentry from "@sentry/react-native";

import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

import "@/global.css";
import "@/localization/i18n";

// Services
import { useInitialSetup } from "@/hooks/useInitialSetup";

// Stores
import { getDirection, isRTL, useAppStore } from "@/stores/app";

// Components
import { ToastProvider } from "@/components/ToastContainer";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
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

  useInitialSetup();

  return (
    <GluestackUIProvider mode={mode}>
      <ToastProvider />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </GluestackUIProvider>
  );
}
