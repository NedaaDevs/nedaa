import "@/localization/i18n";

import { useEffect } from "react";
import { Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Appearance, Platform, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isSkySegments, rootSafeAreaEdges } from "@/utils/safeArea";
import * as SplashScreen from "expo-splash-screen";

import { TamaguiProvider, FontLanguage, useThemeName } from "tamagui";
import { useTheme } from "@/components/ui/theme-color";
import tamaguiConfig from "../../tamagui.config";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { FontProvider } from "@/contexts/FontContext";
import { RTLProvider } from "@/contexts/RTLContext";

import { AppMode, PlatformType } from "@/enums/app";

import { isArabicScript } from "@/constants/Fonts";
import { useAppStore } from "@/stores/app";
import { useQuranStore } from "@/stores/quran";
import { useResolvedQuranTheme } from "@/hooks/useResolvedQuranTheme";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { isDarkMode, nativeColorSchemeFor } from "@/utils/appearance";
import { PhaseContext, usePrayerPhaseSource } from "@/contexts/PhaseContext";

import { ToastHost } from "@/components/ToastHost";
import { LoadingOverlay } from "@/components/feedback";
import CityChangeModal from "@/components/CityChangeModal";
import OnboardingScreen from "@/components/onboarding/OnboardingScreen";
import PlayerBottomSheet from "@/components/athkar/PlayerBottomSheet";
import CrashReportPrompt from "@/components/CrashReportPrompt";
import WhatsNewSheet from "@/components/WhatsNewSheet";

import { useInitialSetup } from "@/hooks/useInitialSetup";
import { useLoadFonts } from "@/config/fonts";
import { useNotificationListeners } from "@/hooks/useNotificationListeners";
import { useNotificationResponses } from "@/hooks/useNotificationResponses";
import { useCityChangeHandler } from "@/hooks/useCityChangeHandler";
import { useAlarmDeepLink } from "@/hooks/useAlarmDeepLink";
import { ScreenshotModeWrapper } from "@/screenshot-mode/ScreenshotModeWrapper";
import { installScreenshotRouter } from "@/screenshot-mode/router";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";
import { usePreferencesHydrated } from "@/hooks/usePreferencesHydrated";

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
  const safeAreaEdges = rootSafeAreaEdges({
    sky: isSkySegments(segments),
    immersiveReader: readerImmersive,
    android: Platform.OS === PlatformType.ANDROID,
  });

  const showOnboarding = isFirstRun && !IS_SCREENSHOT_MODE;

  useNotificationListeners();
  useNotificationResponses(!showOnboarding);
  useAlarmDeepLink();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <SafeAreaView edges={safeAreaEdges} style={{ flex: 1, backgroundColor: safeAreaBg }}>
          <StatusBar style={themeName === AppMode.DARK ? AppMode.LIGHT : AppMode.DARK} />
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

          {showOnboarding ? (
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
          <WhatsNewSheet />
        </SafeAreaView>
      </BottomSheetModalProvider>
      {/* After the sheets' portal host, so a toast shows above an open sheet. */}
      <ToastHost />
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const { mode, locale, hasHydrated } = useAppStore();
  const systemScheme = useColorScheme();

  const [fontsLoaded, fontError] = useLoadFonts();
  const prefsHydrated = usePreferencesHydrated();
  useInitialSetup();

  const phase = usePrayerPhaseSource();

  // Pin the native layer (system dialogs, keyboard, window bg) to the in-app
  // mode so it can't follow the OS day/night independently.
  useEffect(() => {
    if (!hasHydrated) return;
    Appearance.setColorScheme(nativeColorSchemeFor(mode, phase));
  }, [mode, phase, hasHydrated]);

  useEffect(() => {
    trackAppSession();
  }, []);

  useEffect(() => {
    return installScreenshotRouter();
  }, []);

  // Both persisted stores gate the first frame: the app store carries theme
  // and first-run state; the preferences store carries the text-size preset
  // and offer flag, which must not render as defaults and then reflow.
  const isReady = (fontsLoaded || fontError) && hasHydrated && prefsHydrated;

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  const resolvedTheme = isDarkMode(mode, systemScheme, phase) ? AppMode.DARK : AppMode.LIGHT;
  const arabicScript = isArabicScript(locale);

  return (
    <ScreenshotModeWrapper>
      <PhaseContext value={phase}>
        <TamaguiProvider config={tamaguiConfig} defaultTheme={resolvedTheme}>
          <FontLanguage
            body={arabicScript ? "ar" : "default"}
            heading={arabicScript ? "ar" : "default"}>
            <RTLProvider>
              <FontProvider>
                <AppShell />
              </FontProvider>
            </RTLProvider>
          </FontLanguage>
        </TamaguiProvider>
      </PhaseContext>
    </ScreenshotModeWrapper>
  );
}
