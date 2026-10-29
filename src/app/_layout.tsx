import "@/localization/i18n";

import { useEffect } from "react";
import { Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isQuranSegments, isSkySegments, rootSafeAreaEdges } from "@/utils/safeArea";
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
import { ONBOARDING_PATH } from "@/constants/Onboarding";
import { useAppStore } from "@/stores/app";
import { useQuranStore } from "@/stores/quran";
import { useResolvedQuranTheme } from "@/hooks/useResolvedQuranTheme";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { AlertLaunchContext } from "@/contexts/AlertLaunchContext";
import { LivePhaseContext } from "@/contexts/LivePhaseContext";
import { PhaseContext, usePrayerPhaseSource } from "@/contexts/PhaseContext";
import { SchemeContext } from "@/contexts/SchemeContext";
import type { Phase } from "@/constants/Phase";
import { useRootAppearance } from "@/hooks/useRootAppearance";
import { ThemeTransitionProvider } from "@/components/ui/theme-transition";

import { ToastHost } from "@/components/ToastHost";
import { ActionsheetOverlay } from "@/components/ui/actionsheet";
import { useAppCovered, useSheetLayerUp } from "@/components/ui/actionsheet/cover";
import { CityChangeSheet } from "@/components/location/CityChangeSheet";
import { OnboardingGate } from "@/components/onboarding/flow/OnboardingGate";
import PlayerBottomSheet from "@/components/athkar/PlayerBottomSheet";
import CrashReportPrompt from "@/components/CrashReportPrompt";
import WhatsNewSheet from "@/components/WhatsNewSheet";

import { useInitialSetup } from "@/hooks/useInitialSetup";
import { useLoadFonts } from "@/config/fonts";
import { useNotificationListeners } from "@/hooks/useNotificationListeners";
import { useNotificationResponses } from "@/hooks/useNotificationResponses";
import { useAlarmDeepLink } from "@/hooks/useAlarmDeepLink";
import { useLaunchSource } from "@/hooks/useLaunchSource";
import { useOnboardingPath } from "@/hooks/useOnboardingPath";
import { ScreenshotModeWrapper } from "@/screenshot-mode/ScreenshotModeWrapper";
import { installScreenshotRouter } from "@/screenshot-mode/router";
import { IS_SCREENSHOT_MODE } from "@/screenshot-mode/flag";
import { usePreferencesHydrated } from "@/hooks/usePreferencesHydrated";

import { trackAppSession } from "@/utils/reviewPrompt";
import { registerDevMenu } from "@/utils/devMenu";

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

function AppShell({ launchedByAlert }: { launchedByAlert: boolean }) {
  const theme = useTheme();
  const themeName = useThemeName();
  const { path, alertLaunch } = useOnboardingPath(launchedByAlert);

  const segments = useSegments();
  const isQuranScreen = isQuranSegments(segments);
  const quranTheme = useResolvedQuranTheme();
  const readerActive = useQuranStore((s) => s.readerActive);
  // The immersive reader is the visible Quran surface (vs. the version/download
  // chrome, which follows the app theme like everything else).
  const readerImmersive = isQuranScreen && readerActive;
  const safeAreaBg = readerImmersive
    ? QURAN_THEME_COLORS[quranTheme].background
    : theme.background.val;
  const showOnboarding = path !== null && !IS_SCREENSHOT_MODE;
  const gatePath = showOnboarding ? path : null;
  const safeAreaEdges = rootSafeAreaEdges({
    sky: isSkySegments(segments),
    onboarding: showOnboarding,
    immersiveReader: readerImmersive,
    android: Platform.OS === PlatformType.ANDROID,
  });
  const appCovered = useAppCovered();
  const sheetLayerUp = useSheetLayerUp();

  useNotificationListeners();
  // The first run has no tabs to open; the upgrade path keeps the app mounted.
  useNotificationResponses(gatePath !== ONBOARDING_PATH.FIRST_RUN);
  useAlarmDeepLink();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* An open sheet draws the toast in its own layer, so a reader reaches it. */}
      <ActionsheetOverlay value={<ToastHost />}>
        <BottomSheetModalProvider>
          {/* TalkBack skips the app under an open sheet; iOS uses the sheet layer. */}
          <SafeAreaView
            edges={safeAreaEdges}
            style={{ flex: 1, backgroundColor: safeAreaBg }}
            importantForAccessibility={appCovered ? "no-hide-descendants" : "auto"}>
            <StatusBar animated style={themeName === AppMode.DARK ? AppMode.LIGHT : AppMode.DARK} />

            <CityChangeSheet onboarding={showOnboarding} />

            <AlertLaunchContext value={alertLaunch}>
              <OnboardingGate path={gatePath}>
                <Stack
                  screenOptions={{
                    headerShown: false,
                  }}>
                  <Stack.Screen name="(tabs)" />
                </Stack>
              </OnboardingGate>
            </AlertLaunchContext>
            <PlayerBottomSheet />
            <CrashReportPrompt />
            <WhatsNewSheet />
          </SafeAreaView>
        </BottomSheetModalProvider>
      </ActionsheetOverlay>
      {sheetLayerUp ? null : <ToastHost />}
    </GestureHandlerRootView>
  );
}

/** The app in the theme it shows; a light/dark flip waits for its dissolve. */
const AppTheme = ({
  livePhase,
  launchedByAlert,
}: {
  livePhase: Phase | undefined;
  launchedByAlert: boolean;
}) => {
  const locale = useAppStore((state) => state.locale);
  const { phase, scheme, theme } = useRootAppearance(livePhase);
  const arabicScript = isArabicScript(locale);

  return (
    <PhaseContext value={phase}>
      <LivePhaseContext value={phase}>
        <SchemeContext value={scheme}>
          <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}>
            <FontLanguage
              body={arabicScript ? "ar" : "default"}
              heading={arabicScript ? "ar" : "default"}>
              <RTLProvider>
                <FontProvider>
                  <AppShell launchedByAlert={launchedByAlert} />
                </FontProvider>
              </RTLProvider>
            </FontLanguage>
          </TamaguiProvider>
        </SchemeContext>
      </LivePhaseContext>
    </PhaseContext>
  );
};

export default function RootLayout() {
  const hasHydrated = useAppStore((state) => state.hasHydrated);

  const [fontsLoaded, fontError] = useLoadFonts();
  const prefsHydrated = usePreferencesHydrated();
  const launch = useLaunchSource();
  useInitialSetup();

  const phase = usePrayerPhaseSource();

  useEffect(() => {
    trackAppSession();
  }, []);

  useEffect(() => {
    registerDevMenu();
  }, []);

  useEffect(() => {
    return installScreenshotRouter();
  }, []);

  // Both persisted stores gate the first frame: the app store carries theme
  // and first-run state; the preferences store carries the text-size preset
  // and offer flag, which must not render as defaults and then reflow.
  const storesReady = (fontsLoaded || fontError) && hasHydrated && prefsHydrated;
  // The launch source decides whether the upgrade path covers the first frame.
  const isReady = storesReady && launch.ready;

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <ScreenshotModeWrapper>
      <ThemeTransitionProvider>
        <AppTheme livePhase={phase} launchedByAlert={launch.launchedByAlert} />
      </ThemeTransitionProvider>
    </ScreenshotModeWrapper>
  );
}
