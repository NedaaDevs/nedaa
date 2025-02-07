import { Stack } from "expo-router";

import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

import "@/global.css";
import "@/localization/i18n";

// Stores
import { getDirection, isRTL, useAppStore } from "@/stores/app";

// Components
import { ToastProvider } from "@/components/ToastContainer";

// Hooks
import { useInitialSetup } from "@/hooks/useInitialSetup";
import { useRTLSetup } from "@/hooks/useRTLSetup";

export default function RootLayout() {
  const { mode, locale } = useAppStore();

  const shouldBeRTL = isRTL(getDirection(locale));
  useRTLSetup(shouldBeRTL);

  useInitialSetup();

  return (
    <GluestackUIProvider mode={mode}>
      <ToastProvider />
      <Stack
        screenOptions={{
          headerShown: false,
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </GluestackUIProvider>
  );
}
