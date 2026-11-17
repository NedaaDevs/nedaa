import { useState, useEffect, useEffectEvent } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";
import type { ParseKeys } from "i18next";

import MyAthkarList from "@/components/athkar/MyAthkarList";
import { AthkarSessionScreen } from "@/components/athkar/session/AthkarSessionScreen";
import { useAthkarLandingScreenshotSeed } from "@/components/athkar/useAthkarScreenshotSeed";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { HighlightEdge, useElevationShadow } from "@/components/ui/material/edge";
import { Pressable } from "@/components/ui/pressable";
import { SkyOccluder } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import { ATHKAR_TYPE, MY_ATHKAR_TAB } from "@/constants/Athkar";
import { ELEVATION_LEVEL } from "@/constants/Elevation";
import { useInitializeAthkar } from "@/hooks/useInitializeAthkar";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { athkarPlayer } from "@/services/athkar-player";
import { useAthkarStore } from "@/stores/athkar";
import { PLAYER_STATE } from "@/types/athkar-audio";
import { getCurrentAthkarPeriod } from "@/utils/athkar";

const MY_ATHKAR_SUPPORTED_LANGUAGES = ["ar", "en"];

type Period = typeof ATHKAR_TYPE.MORNING | typeof ATHKAR_TYPE.EVENING;
type TabId = Period | typeof MY_ATHKAR_TAB;

// `label` is drawn and stays on one line; `name` is spoken in full.
const TAB_TITLE = {
  [ATHKAR_TYPE.MORNING]: { label: "athkar.tab.morning", name: "athkar.morning" },
  [ATHKAR_TYPE.EVENING]: { label: "athkar.tab.evening", name: "athkar.evening" },
  [MY_ATHKAR_TAB]: { label: "athkar.myAthkar", name: "athkar.myAthkar" },
} as const satisfies Record<TabId, { label: ParseKeys; name: ParseKeys }>;

const PERIOD_TABS: readonly TabId[] = [ATHKAR_TYPE.MORNING, ATHKAR_TYPE.EVENING];
const ALL_TABS: readonly TabId[] = [...PERIOD_TABS, MY_ATHKAR_TAB];

// A label holds one line: a label too wide for its tab shrinks to this share of its size.
export const TAB_LABEL_MIN_SCALE = 0.8;

type TabProps = { label: string; name: string; selected: boolean; onPress: () => void };

const Tab = ({ label, name, selected, onPress }: TabProps) => {
  const lift = useElevationShadow(ELEVATION_LEVEL.E1);
  return (
    <Pressable
      role="tab"
      accessibilityLabel={name}
      accessibilityState={{ selected }}
      onPress={onPress}
      flexGrow={1}
      flexBasis={0}
      minHeight="$target"
      paddingHorizontal="$2"
      alignItems="center"
      justifyContent="center"
      borderRadius="$pill"
      backgroundColor={selected ? "$raised" : "transparent"}
      style={selected ? { boxShadow: lift } : undefined}>
      {selected ? <HighlightEdge radius="$pill" /> : null}
      <Text
        size="label"
        fontWeight={selected ? "600" : "500"}
        color={selected ? "$fg" : "$muted"}
        textAlign="center"
        // Android shrinks a label only inside a fixed width.
        alignSelf="stretch"
        // The tab pads the label; no end room on top of it.
        glyph
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={TAB_LABEL_MIN_SCALE}>
        {label}
      </Text>
    </Pressable>
  );
};

const AthkarTabs = () => {
  const { t, i18n } = useTranslation();
  const tabBarInset = useTabBarInset();

  const setCurrentType = useAthkarStore((s) => s.setCurrentType);
  const validateDailyStreak = useAthkarStore((s) => s.validateDailyStreak);
  const playerState = useAthkarStore((s) => s.playerState);

  const tabs = MY_ATHKAR_SUPPORTED_LANGUAGES.includes(i18n.language) ? ALL_TABS : PERIOD_TABS;
  const [activeTab, setActiveTab] = useState<TabId>(() => getCurrentAthkarPeriod());

  useInitializeAthkar();

  // A screenshot run seeds morning progress and names the period to open on.
  const screenshotPeriod = useAthkarLandingScreenshotSeed();

  const openTab = useEffectEvent(() => {
    if (activeTab !== MY_ATHKAR_TAB) setCurrentType(activeTab);
    void validateDailyStreak();
  });
  useEffect(() => {
    openTab();
  }, []);

  const [seeded, setSeeded] = useState<typeof screenshotPeriod>(null);
  if (screenshotPeriod !== seeded) {
    setSeeded(screenshotPeriod);
    if (screenshotPeriod) setActiveTab(screenshotPeriod);
  }
  useEffect(() => {
    if (screenshotPeriod) setCurrentType(screenshotPeriod);
  }, [screenshotPeriod, setCurrentType]);

  const select = (tab: TabId) => {
    // Audio belongs to the tab it started on.
    if (tab !== activeTab && playerState !== PLAYER_STATE.IDLE) void athkarPlayer.stop();
    setActiveTab(tab);
    if (tab !== MY_ATHKAR_TAB) setCurrentType(tab);
  };

  return (
    <Box flex={1}>
      <SkyOccluder>
        <HStack
          role="tablist"
          marginTop="$2"
          marginHorizontal="$4"
          gap="$0.5"
          padding="$0.5"
          borderRadius="$pill"
          backgroundColor="$pressed">
          {tabs.map((tab) => (
            <Tab
              key={tab}
              label={t(TAB_TITLE[tab].label)}
              name={t(TAB_TITLE[tab].name)}
              selected={activeTab === tab}
              onPress={() => select(tab)}
            />
          ))}
        </HStack>
      </SkyOccluder>

      {activeTab === MY_ATHKAR_TAB ? (
        <ScrollView
          style={{ flex: 1, backgroundColor: "transparent" }}
          contentContainerStyle={{ paddingBottom: tabBarInset }}>
          <Box padding="$4">
            <MyAthkarList />
          </Box>
        </ScrollView>
      ) : (
        <SkyOccluder style={{ flex: 1 }}>
          <Box flex={1} paddingHorizontal="$4" paddingBottom={tabBarInset}>
            <AthkarSessionScreen />
          </Box>
        </SkyOccluder>
      )}
    </Box>
  );
};

export default AthkarTabs;
