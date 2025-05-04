import "../../assets/global.css";
import "@/localization/i18n";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { GestureHandlerRootView } from "react-native-gesture-handler";

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
      <GestureHandlerRootView>
        <StatusBar />
        <ToastProvider />
        <Stack
          screenOptions={{
            headerShown: false,
          }}>
          <Stack.Screen name="index" />
        </Stack>
      </GestureHandlerRootView>
    </GluestackUIProvider>
  );
}
