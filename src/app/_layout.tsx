import "@/localization/i18n";
import "@tamagui/native/setup-zeego";
import "@tamagui/linear-gradient";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";

import { TamaguiProvider, FontLanguage, useTheme, useThemeName } from "tamagui";
import tamaguiConfig from "../../tamagui.config";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { FontProvider } from "@/contexts/FontContext";
import { RTLProvider } from "@/contexts/RTLContext";

import { useAppStore } from "@/stores/app";

import { ToastProvider } from "@/components/ToastContainer";
import { LoadingOverlay } from "@/components/feedback";
import CityChangeModal from "@/components/CityChangeModal";
import OnboardingScreen from "@/components/onboarding/OnboardingScreen";

import { useInitialSetup } from "@/hooks/useInitialSetup";
import { useLoadFonts } from "@/config/fonts";
import { useNotificationListeners } from "@/hooks/useNotificationListeners";
import { useCityChangeHandler } from "@/hooks/useCityChangeHandler";
import { useAlarmDeepLink } from "@/hooks/useAlarmDeepLink";

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

function AppShell() {
  const theme = useTheme();
  const themeName = useThemeName();
  const { showLoadingOverlay, loadingMessage, isFirstRun } = useAppStore();
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        edges={["top", "right", "left"]}
        style={{ flex: 1, backgroundColor: theme.background.val }}>
        <StatusBar style={themeName === "dark" ? "light" : "dark"} />
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

        {isFirstRun ? (
          <OnboardingScreen />
        ) : (
          <Stack
            screenOptions={{
              headerShown: false,
            }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const { mode, locale } = useAppStore();
  const systemScheme = useColorScheme();

  const [fontsLoaded] = useLoadFonts();
  useInitialSetup();

  if (fontsLoaded) {
    SplashScreen.hideAsync();
  }

  const resolvedTheme =
    mode === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : mode === "dark"
        ? "dark"
        : "light";

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={resolvedTheme}>
      <FontLanguage
        body={locale === "ar" ? "ar" : undefined}
        heading={locale === "ar" ? "ar" : undefined}>
        <RTLProvider>
          <FontProvider>
            <AppShell />
          </FontProvider>
        </RTLProvider>
      </FontLanguage>
    </TamaguiProvider>
  );
}
