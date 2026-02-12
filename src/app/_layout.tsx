import "../../assets/global.css";
import "@/localization/i18n";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";

import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { FontProvider } from "@/contexts/FontContext";
import { RTLProvider } from "@/contexts/RTLContext";

// Stores
import { useAppStore } from "@/stores/app";

// Components
import { ToastProvider } from "@/components/ToastContainer";
import { LoadingOverlay } from "@/components/feedback";
import CityChangeModal from "@/components/CityChangeModal";
import OnboardingScreen from "@/components/onboarding/OnboardingScreen";

// Hooks
import { useInitialSetup } from "@/hooks/useInitialSetup";
import { useLoadFonts } from "@/config/fonts";
import { useNotificationListeners } from "@/hooks/useNotificationListeners";
import { useCityChangeHandler } from "@/hooks/useCityChangeHandler";
import { useAlarmDeepLink } from "@/hooks/useAlarmDeepLink";
import { useColorScheme } from "nativewind";

/** For Viewing db in dev */
// import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
// import * as SQLite from "expo-sqlite";
// import { ATHKAR_DB_NAME, DB_NAME } from "@/constants/DB";

// const db = SQLite.openDatabaseSync(DB_NAME);

SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});
SplashScreen.preventAutoHideAsync();

function MainAppContent() {
  const { showLoadingOverlay, loadingMessage } = useAppStore();
  const {
    showCityChangeModal,
    pendingCityChange,
    isUpdatingLocation,
    handleCityChangeUpdate,
    dismissCityChangeModal,
  } = useCityChangeHandler();

  useNotificationListeners();
  useAlarmDeepLink();

  return (
    <>
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
    </>
  );
}

export default function RootLayout() {
  const { mode, isFirstRun } = useAppStore();
  const colorScheme = useColorScheme();
  // useDrizzleStudio(db);

  useLoadFonts();
  useInitialSetup();
  SplashScreen.hideAsync();

  return (
    <GluestackUIProvider mode={mode}>
      <RTLProvider>
        <FontProvider>
          <GestureHandlerRootView className="flex-1">
            <SafeAreaView edges={["top", "right", "left"]} className="flex-1 bg-background">
              <StatusBar style={colorScheme.colorScheme === "dark" ? "light" : "dark"} />
              {isFirstRun ? <OnboardingScreen /> : <MainAppContent />}
            </SafeAreaView>
          </GestureHandlerRootView>
        </FontProvider>
      </RTLProvider>
    </GluestackUIProvider>
  );
}
