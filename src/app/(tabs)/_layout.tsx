import { useContext, useEffect } from "react";
import { Tabs, router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { BottomTabBarHeightCallbackContext } from "expo-router/build/react-navigation/bottom-tabs/utils/BottomTabBarHeightCallbackContext";
import { useTranslation } from "react-i18next";

// Stores
import { useAppStore } from "@/stores/app";
import { useQuranStore } from "@/stores/quran";
import { usePreferencesStore } from "@/stores/preferences";

// Enums
import { OpeningTab, type OpeningTabValue } from "@/enums/app";

// Icons
import { AlarmClock, BookOpen, Ellipsis, House } from "lucide-react-native";

// Components
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { TabBarItem } from "@/components/ui/tab-bar-item";
import MiniPlayerBar from "@/components/athkar/MiniPlayerBar";
import { QuranMiniPlayer } from "@/components/quran/listen/QuranMiniPlayer";

// Utils
import { isAthkarSupported } from "@/utils/athkar";

const OPENING_TAB_ROUTE: Record<Exclude<OpeningTabValue, "index">, Href> = {
  [OpeningTab.ATHKAR]: "/(tabs)/athkar",
  [OpeningTab.QURAN]: "/(tabs)/quran",
  [OpeningTab.TOOLS]: "/(tabs)/tools",
};

/** The bar's tabs, in the order it shows them. */
const TAB_ITEMS = [
  { name: OpeningTab.HOME, title: "a11y.tab.home", icon: House },
  { name: OpeningTab.QURAN, title: "a11y.tab.quran", icon: BookOpen },
  { name: OpeningTab.ATHKAR, title: "a11y.tab.athkar", icon: AlarmClock },
  { name: OpeningTab.TOOLS, title: "a11y.tab.tools", icon: Ellipsis },
] as const;

export const TAB_BAR_PART = { FRAME: "tab-bar-frame" } as const;

/** Tabs that draw a sky; the bar floats over them so the sky shows through. */
const FLOATING_TABS: readonly string[] = [OpeningTab.HOME];

type AppTabBarProps = BottomTabBarProps & {
  tabs: readonly (typeof TAB_ITEMS)[number][];
  readerActive: boolean;
};

const AppTabBar = ({ state, navigation, tabs, readerActive }: AppTabBarProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // The tab view gives each screen this height, so a screen under a floating bar
  // knows how much room to leave.
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  const focused = state.routes[state.index].name;
  // Quran is full screen, so the mini player pads the bottom inset.
  const tabBarHidden = focused === OpeningTab.QURAN;
  const floating = FLOATING_TABS.includes(focused);

  return (
    <Box
      testID={TAB_BAR_PART.FRAME}
      onLayout={({ nativeEvent }) => reportHeight?.(nativeEvent.layout.height)}
      {...(floating
        ? { position: "absolute", start: 0, end: 0, bottom: 0 }
        : { backgroundColor: "$backgroundSecondary" })}>
      {!readerActive && <QuranMiniPlayer padBottomInset={tabBarHidden} />}
      <MiniPlayerBar />
      {!tabBarHidden && (
        <HStack
          accessibilityRole="tablist"
          gap="$0.5"
          paddingTop="$1.5"
          paddingHorizontal="$2.5"
          paddingBottom={insets.bottom}
          borderTopWidth={1}
          borderColor="$border"
          backgroundColor="$bar">
          {tabs.map((tab) => {
            const route = state.routes.find((candidate) => candidate.name === tab.name);
            if (!route) return null;
            const selected = focused === tab.name;
            return (
              <TabBarItem
                key={route.key}
                label={t(tab.title)}
                icon={tab.icon}
                selected={selected}
                onPress={() => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!selected && !event.defaultPrevented) {
                    navigation.navigate(route.name, route.params);
                  }
                }}
                onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              />
            );
          })}
        </HStack>
      )}
    </Box>
  );
};

// Honoured once per app launch: the effect below runs again on a locale change, and
// re-navigating then would yank the user out of whatever tab they were on.
let openingTabApplied = false;

const TabsLayout = () => {
  const locale = useAppStore((state) => state.locale);
  // The immersive reader owns the whole screen — the global Listen mini-player
  // would overlay the page and disrupt reading, so suppress it there.
  const readerActive = useQuranStore((s) => s.readerActive);
  const { t } = useTranslation();
  const tabs = TAB_ITEMS.filter(
    (tab) => tab.name !== OpeningTab.ATHKAR || isAthkarSupported(locale)
  );

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

  const renderTabBar = (props: BottomTabBarProps) => (
    <AppTabBar {...props} tabs={tabs} readerActive={readerActive} />
  );

  // Other tab routes register from their files; only the bar shows tabs.
  return (
    <Tabs tabBar={renderTabBar} screenOptions={{ headerShown: false }}>
      {TAB_ITEMS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: t(tab.title) }} />
      ))}
    </Tabs>
  );
};

export default TabsLayout;
