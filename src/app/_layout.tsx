import "@/localization/i18n";
import "@tamagui/linear-gradient";

import { useEffect } from "react";
import { Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Appearance, Platform, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";

import { TamaguiProvider, FontLanguage, useTheme, useThemeName } from "tamagui";
import tamaguiConfig from "../../tamagui.config";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { FontProvider } from "@/contexts/FontContext";
import { RTLProvider } from "@/contexts/RTLContext";

import { PlatformType } from "@/enums/app";
import { useAppStore } from "@/stores/app";
import { useQuranStore } from "@/stores/quran";
import { useResolvedQuranTheme } from "@/hooks/useResolvedQuranTheme";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { nativeColorSchemeFor } from "@/utils/appearance";

import { ToastProvider } from "@/components/ToastContainer";
import { LoadingOverlay } from "@/components/feedback";
import CityChangeModal from "@/components/CityChangeModal";
import OnboardingScreen from "@/components/onboarding/OnboardingScreen";
import PlayerBottomSheet from "@/components/athkar/PlayerBottomSheet";
import CrashReportPrompt from "@/components/CrashReportPrompt";

import { useInitialSetup } from "@/hooks/useInitialSetup";
import { useLoadFonts } from "@/config/fonts";
import { useNotificationListeners } from "@/hooks/useNotificationListeners";
import { useCityChangeHandler } from "@/hooks/useCityChangeHandler";
import { useAlarmDeepLink } from "@/hooks/useAlarmDeepLink";
import { ScreenshotModeWrapper } from "@/screenshot-mode/ScreenshotModeWrapper";
import { installScreenshotRouter } from "@/screenshot-mode/router";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";

import { athkarPlayer } from "@/services/athkar-player";
import { trackAppSession } from "@/utils/reviewPrompt";

import "@/tasks/backgroundRefresh";

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
    updateState,
    handleCityChangeUpdate,
    dismissCityChangeModal,
    retryUpdate,
  } = useCityChangeHandler();

  const segments = useSegments();
  const isQuranScreen = segments[0] === "(tabs)" && segments[1] === "quran";
  const quranTheme = useResolvedQuranTheme();
  const readerActive = useQuranStore((s) => s.readerActive);
  // The immersive reader is the visible Quran surface (vs. the version/download
  // chrome, which follows the app theme like everything else).
  const readerImmersive = isQuranScreen && readerActive;
  const safeAreaBg = readerImmersive
    ? QURAN_THEME_COLORS[quranTheme].background
    : theme.background.val;
  // Android: make the immersive reader full-bleed by dropping the top safe-area
  // edge, so the status bar overlays the page. Otherwise hiding the bar collapses
  // the top inset and showing it again re-pads, shoving the page down on every
  // chrome toggle. iOS keeps the top edge — its inset is the physical notch, which
  // persists regardless of status-bar visibility, so there's no reflow to fix.
  const safeAreaEdges: ("top" | "right" | "left")[] =
    readerImmersive && Platform.OS === PlatformType.ANDROID
      ? ["right", "left"]
      : ["top", "right", "left"];

  useNotificationListeners();
  useAlarmDeepLink();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <SafeAreaView edges={safeAreaEdges} style={{ flex: 1, backgroundColor: safeAreaBg }}>
          <StatusBar style={themeName === "dark" ? "light" : "dark"} />
          <ToastProvider />
          <LoadingOverlay visible={showLoadingOverlay} message={loadingMessage} />

          {pendingCityChange && (
            <CityChangeModal
              isOpen={showCityChangeModal}
              onClose={dismissCityChangeModal}
              onUpdate={handleCityChangeUpdate}
              onRetry={retryUpdate}
              currentCity={pendingCityChange.currentCity}
              newCity={pendingCityChange.newCity}
              updateState={updateState}
            />
          )}

          {isFirstRun && !IS_SCREENSHOT_MODE ? (
            <OnboardingScreen />
          ) : (
            <Stack
              screenOptions={{
                headerShown: false,
              }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          )}
          <PlayerBottomSheet />
          <CrashReportPrompt />
        </SafeAreaView>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const { mode, locale, hasHydrated } = useAppStore();
  const systemScheme = useColorScheme();

  const [fontsLoaded, fontError] = useLoadFonts();
  useInitialSetup();

  // Pin the native layer (system dialogs, keyboard, window bg) to the in-app
  // mode so it can't follow the OS day/night independently.
  useEffect(() => {
    if (!hasHydrated) return;
    Appearance.setColorScheme(nativeColorSchemeFor(mode));
  }, [mode, hasHydrated]);

  useEffect(() => {
    athkarPlayer.initialize();
    trackAppSession();
  }, []);

  useEffect(() => {
    return installScreenshotRouter();
  }, []);

  const isReady = (fontsLoaded || fontError) && hasHydrated;

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  const resolvedTheme =
    mode === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : mode === "dark"
        ? "dark"
        : "light";

  const isArabicScript = locale === "ar" || locale === "ur";

  return (
    <ScreenshotModeWrapper>
      <TamaguiProvider config={tamaguiConfig} defaultTheme={resolvedTheme}>
        <FontLanguage
          body={isArabicScript ? "ar" : "default"}
          heading={isArabicScript ? "ar" : "default"}>
          <RTLProvider>
            <FontProvider>
              <AppShell />
            </FontProvider>
          </RTLProvider>
        </FontLanguage>
      </TamaguiProvider>
    </ScreenshotModeWrapper>
  );
}
