import "../../assets/global.css";
import "@/localization/i18n";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";

import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { FontProvider } from "@/contexts/FontContext";

// Stores
import { getDirection, isRTL, useAppStore } from "@/stores/app";

// Components
import { ToastProvider } from "@/components/ToastContainer";
import { LoadingOverlay } from "@/components/feedback";
import CityChangeModal from "@/components/CityChangeModal";

// Hooks
import { useInitialSetup } from "@/hooks/useInitialSetup";
import { useRTLSetup } from "@/hooks/useRTLSetup";
import { useLoadFonts } from "@/config/fonts";
import { useNotificationListeners } from "@/hooks/useNotificationListeners";
import { useCityChangeHandler } from "@/hooks/useCityChangeHandler";

/** For Viewing db in dev */
// import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
// import * as SQLite from "expo-sqlite";
// import { ATHKAR_DB_NAME, DB_NAME } from "@/constants/DB";

// const db = SQLite.openDatabaseSync(DB_NAME);

SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

export default function RootLayout() {
  SplashScreen.preventAutoHideAsync();
  const { mode, locale, showLoadingOverlay, loadingMessage } = useAppStore();
  // useDrizzleStudio(db);
  const {
    showCityChangeModal,
    pendingCityChange,
    isUpdatingLocation,
    handleCityChangeUpdate,
    dismissCityChangeModal,
  } = useCityChangeHandler();

  const shouldBeRTL = isRTL(getDirection(locale));
  useRTLSetup(shouldBeRTL);

  useLoadFonts();
  useInitialSetup();
  useNotificationListeners();
  SplashScreen.hideAsync();
  return (
    <GluestackUIProvider mode={mode}>
      <FontProvider>
        <GestureHandlerRootView>
          <SafeAreaView edges={["top", "right", "left"]} className="flex-1">
            <StatusBar />
            <ToastProvider />
            <LoadingOverlay visible={showLoadingOverlay} message={loadingMessage} />

            {pendingCityChange && (
              <CityChangeModal
                isOpen={showCityChangeModal}
                onClose={dismissCityChangeModal}
                onUpdate={handleCityChangeUpdate}
                currentCity={pendingCityChange.currentCity}
                newCity={pendingCityChange.newCity}
                isUpdating={isUpdatingLocation}
              />
            )}

            <Stack
              screenOptions={{
                headerShown: false,
              }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </SafeAreaView>
        </GestureHandlerRootView>
      </FontProvider>
    </GluestackUIProvider>
  );
}
