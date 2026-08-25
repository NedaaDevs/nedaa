import { useEffect } from "react";
import { Tabs, router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTextScale } from "@/hooks/useTextScale";
import { BottomTabBar, BottomTabBarProps } from "expo-router/js-tabs";
import { useTranslation } from "react-i18next";

// Stores
import { useAppStore } from "@/stores/app";
import { useQuranStore } from "@/stores/quran";
import { usePreferencesStore } from "@/stores/preferences";

// Enums
import { OpeningTab, type OpeningTabValue } from "@/enums/app";

// Services
import { QuranContentDB } from "@/services/quran-content-db";

// Icons
import { Home, Settings, BookOpenText, BookOpen, Wrench } from "lucide-react-native";

// Components
import { Box } from "@/components/ui/box";
import MiniPlayerBar from "@/components/athkar/MiniPlayerBar";
import { QuranMiniPlayer } from "@/components/quran/listen/QuranMiniPlayer";

// Utils
import { isAthkarSupported } from "@/utils/athkar";

// Hooks
import { useTheme } from "tamagui";

const OPENING_TAB_ROUTE: Record<Exclude<OpeningTabValue, "index">, Href> = {
  [OpeningTab.ATHKAR]: "/(tabs)/athkar",
  [OpeningTab.QURAN]: "/(tabs)/quran",
  [OpeningTab.TOOLS]: "/(tabs)/tools",
};

// Honoured once per app launch. This layout remounts whenever the theme changes
// (key={`tabs-${mode}`}), and re-navigating then would yank the user out of
// whatever tab they were on.
let openingTabApplied = false;

const TabsLayout = () => {
  const { locale, mode } = useAppStore();
  // The immersive reader owns the whole screen — the global Listen mini-player
  // would overlay the page and disrupt reading, so suppress it there.
  const readerActive = useQuranStore((s) => s.readerActive);
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const textScale = useTextScale();

  // Warm the content DB at startup so the reader opens without a loading flash.
  useEffect(() => {
    void QuranContentDB.openQuranDb();
  }, []);

  // Land on the user's chosen tab. The preference is persisted, so wait for
  // rehydration or the stored choice is missed on a cold start.
  useEffect(() => {
    if (openingTabApplied) return;

    const apply = () => {
      if (openingTabApplied) return;
      openingTabApplied = true;

      const tab = usePreferencesStore.getState().openingTab;
      if (tab === OpeningTab.HOME) return;
      // A tab can become unreachable after it was chosen — the locale no longer
      // supports it. Fall back to home rather than a hidden route.
      if (tab === OpeningTab.ATHKAR && !isAthkarSupported(locale)) return;

      router.replace(OPENING_TAB_ROUTE[tab]);
    };

    if (usePreferencesStore.persist.hasHydrated()) {
      apply();
      return;
    }
    return usePreferencesStore.persist.onFinishHydration(apply);
  }, [locale]);

  return (
    <Tabs
      key={`tabs-${mode}`}
      tabBar={(props: BottomTabBarProps) => {
        // The quran tab hides the tab bar (display: none), leaving the mini
        // player as the bottom-most element — it must pad the bottom inset then.
        const tabBarHidden = props.state.routes[props.state.index].name === "quran";
        return (
          <Box backgroundColor="$backgroundSecondary">
            {!readerActive && <QuranMiniPlayer padBottomInset={tabBarHidden} />}
            <MiniPlayerBar />
            <BottomTabBar {...props} />
          </Box>
        );
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary.val,
        tabBarInactiveTintColor: theme.typographySecondary.val,
        tabBarAllowFontScaling: false,
        tabBarLabelStyle: {
          // react-navigation's default label is ~12px; the app preset scales it.
          fontSize: 12 * textScale,
        },
        tabBarStyle: {
          // The vendored bar sizes itself from a numeric height only, so the
          // label's extra line height is added here rather than via minHeight.
          height: 60 + Math.ceil(16 * (textScale - 1)) + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 5,
          backgroundColor: theme.backgroundSecondary.val,
          borderTopColor: theme.outline.val,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t("a11y.tab.home"),
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="athkar"
        options={{
          title: t("a11y.tab.athkar"),
          href: isAthkarSupported(locale) ? "/(tabs)/athkar" : null,
          tabBarIcon: ({ color, size }) => <BookOpenText color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="quran"
        options={{
          title: t("a11y.tab.quran"),
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} />,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="qada"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="tools"
        options={{
          title: t("a11y.tab.tools"),
          tabBarIcon: ({ color, size }) => <Wrench color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="compass"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: t("a11y.tab.settings"),
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
};

export default TabsLayout;
