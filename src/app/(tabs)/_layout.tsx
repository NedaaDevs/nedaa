import { useContext, useEffect } from "react";
import { Platform } from "react-native";
import { router, type Href } from "expo-router";
import {
  Tabs,
  BottomTabBarHeightCallbackContext,
  type BottomTabBarProps,
} from "expo-router/js-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

// Stores
import { useQuranStore } from "@/stores/quran";
import { usePreferencesStore } from "@/stores/preferences";
import { useTabBarFrameStore } from "@/stores/tabBarFrame";

// Enums
import { HiddenTab, OpeningTab, PlatformType, type OpeningTabValue } from "@/enums/app";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { TAB_ITEMS, type TabItem } from "@/constants/TabBar";

// Hooks
import { useBarTabs } from "@/hooks/useBarTabs";
import { useHaptic } from "@/hooks/useHaptic";

// Utils
import { tabBarEdgeGap } from "@/utils/safeArea";

// Components
import { Box } from "@/components/ui/box";
import { TabBar, TabBarItem } from "@/components/ui/tab-bar-item";
import MiniPlayerBar from "@/components/athkar/MiniPlayerBar";
import { QuranMiniPlayer } from "@/components/quran/listen/QuranMiniPlayer";

/** Where each bar tab lives; the opening-tab preference lands there too. */
const TAB_HREF = {
  [OpeningTab.HOME]: BACK_DESTINATION.HOME.href,
  [OpeningTab.QURAN]: BACK_DESTINATION.QURAN.href,
  [OpeningTab.ATHKAR]: BACK_DESTINATION.ATHKAR.href,
  [OpeningTab.TOOLS]: BACK_DESTINATION.TOOLS.href,
} as const satisfies Record<OpeningTabValue, Href>;

/** Every route the tabs declare: the bar's tabs, then the ones it hides. */
export const TAB_ROUTES = [...TAB_ITEMS.map((tab) => tab.name), ...Object.values(HiddenTab)];

export const TAB_BAR_PART = { FRAME: "tab-bar-frame" } as const;

// Reads only the tab state; a press switches tabs by href through the router.
type AppTabBarProps = Pick<BottomTabBarProps, "state"> & {
  tabs: readonly TabItem[];
  readerActive: boolean;
};

const AppTabBar = ({ state, tabs, readerActive }: AppTabBarProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const selectionHaptic = useHaptic(HAPTIC_FEEDBACK.SELECTION);
  // The tab view gives each screen this height, so a screen under the floating
  // bar knows how much room to leave.
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  const setFrameHeight = useTabBarFrameStore((state) => state.setHeight);
  const focused = state.routes[state.index].name;
  // Quran is full screen, so the mini player pads the bottom inset.
  const tabBarHidden = focused === OpeningTab.QURAN;

  return (
    <Box
      testID={TAB_BAR_PART.FRAME}
      // The frame spans the screen; the gaps beside the pill stay the screen's.
      pointerEvents="box-none"
      onLayout={({ nativeEvent }) => {
        reportHeight?.(nativeEvent.layout.height);
        setFrameHeight(nativeEvent.layout.height);
      }}
      {...(tabBarHidden
        ? { backgroundColor: "$backgroundSecondary" }
        : { position: "absolute", start: 0, end: 0, bottom: 0 })}>
      {!(readerActive && tabBarHidden) && <QuranMiniPlayer padBottomInset={tabBarHidden} />}
      <MiniPlayerBar />
      {!tabBarHidden && (
        <TabBar
          selectedIndex={tabs.findIndex((tab) => tab.name === focused)}
          count={tabs.length}
          edgeGap={tabBarEdgeGap({
            android: Platform.OS === PlatformType.ANDROID,
            insetBottom: insets.bottom,
          })}>
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
                  if (selected) return;
                  void selectionHaptic();
                  router.navigate(TAB_HREF[tab.name]);
                }}
              />
            );
          })}
        </TabBar>
      )}
    </Box>
  );
};

// Honoured once per app launch: the effect below runs again when the bar changes, and
// re-navigating then would yank the user out of whatever tab they were on.
let openingTabApplied = false;

const TabsLayout = () => {
  // The immersive reader owns the whole screen — the global Listen mini-player
  // would overlay the page and disrupt reading, so suppress it there.
  const readerActive = useQuranStore((s) => s.readerActive);
  const { t } = useTranslation();
  const tabs = useBarTabs();

  // Land on the user's chosen tab. The preference is persisted, so wait for
  // rehydration or the stored choice is missed on a cold start.
  useEffect(() => {
    if (openingTabApplied) return;

    const apply = () => {
      if (openingTabApplied) return;
      openingTabApplied = true;

      const stored = usePreferencesStore.getState().openingTab;
      if (stored === OpeningTab.HOME) return;
      // A tab chosen in another locale may be off the bar; home stands in for it.
      if (!tabs.some((tab) => tab.name === stored)) return;

      router.replace(TAB_HREF[stored]);
    };

    if (usePreferencesStore.persist.hasHydrated()) {
      apply();
      return;
    }
    return usePreferencesStore.persist.onFinishHydration(apply);
  }, [tabs]);

  const renderTabBar = ({ state }: BottomTabBarProps) => (
    <AppTabBar state={state} tabs={tabs} readerActive={readerActive} />
  );

  // Every tab route is declared; the bar shows TAB_ITEMS alone.
  return (
    <Tabs tabBar={renderTabBar} screenOptions={{ headerShown: false }}>
      {TAB_ROUTES.map((name) => {
        const item = TAB_ITEMS.find((tab) => tab.name === name);
        return <Tabs.Screen key={name} name={name} options={item && { title: t(item.title) }} />;
      })}
    </Tabs>
  );
};

export default TabsLayout;
