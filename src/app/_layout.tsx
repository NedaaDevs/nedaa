import "../../assets/global.css";
import "@/localization/i18n";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import FontProvider from "@/contexts/FontContext";

// Stores
import { getDirection, isRTL, useAppStore } from "@/stores/app";

// Components
import { ToastProvider } from "@/components/ToastContainer";

// Hooks
import { useInitialSetup } from "@/hooks/useInitialSetup";
import { useRTLSetup } from "@/hooks/useRTLSetup";
import { useLoadFonts } from "@/config/fonts";

export default function RootLayout() {
  const { mode, locale } = useAppStore();

  const shouldBeRTL = isRTL(getDirection(locale));
  useRTLSetup(shouldBeRTL);

  useLoadFonts();
  useInitialSetup();

  return (
    <GluestackUIProvider mode={mode}>
      <FontProvider>
        <GestureHandlerRootView>
          <SafeAreaView className="flex-1">
            {/* TODO: Debug why status bar show a white background on dark mode with style = auto*/}
            <StatusBar style="dark" translucent={true} />
            <ToastProvider />
            <Stack
              screenOptions={{
                headerShown: false,
              }}>
              <Stack.Screen name="index" />
            </Stack>
          </SafeAreaView>
        </GestureHandlerRootView>
      </FontProvider>
    </GluestackUIProvider>
  );
}
