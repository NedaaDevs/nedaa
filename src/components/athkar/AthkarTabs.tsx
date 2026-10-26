import { useState, useEffect, useCallback, useEffectEvent } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Fab, FabIcon } from "@/components/ui/fab";
import { Icon } from "@/components/ui/icon";

import AthkarList from "@/components/athkar/AthkarList";
import MyAthkarList from "@/components/athkar/MyAthkarList";
import AudioOnboarding from "@/components/athkar/AudioOnboarding";

// Stores
import { useAthkarStore } from "@/stores/athkar";

// Hooks
import { useInitializeAthkar } from "@/hooks/useInitializeAthkar";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useAthkarLandingScreenshotSeed } from "@/components/athkar/useAthkarScreenshotSeed";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

// Services
import { athkarPlayer } from "@/services/athkar-player";

// Icons
import { Sun, Moon, Focus, BookOpen } from "lucide-react-native";

// Types
import { AthkarType } from "@/types/athkar";

// Utils
import { getCurrentAthkarPeriod } from "@/utils/athkar";

const MY_ATHKAR_SUPPORTED_LANGUAGES = ["ar", "en"];

const AthkarTabs = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const tabBarInset = useTabBarInset();

  const setCurrentType = useAthkarStore((s) => s.setCurrentType);
  const validateDailyStreak = useAthkarStore((s) => s.validateDailyStreak);
  const playerState = useAthkarStore((s) => s.playerState);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const showMyAthkarTab = MY_ATHKAR_SUPPORTED_LANGUAGES.includes(i18n.language);

  type activeTabType = Exclude<AthkarType, "all"> | "my-athkar";

  const [activeTab, setActiveTab] = useState<activeTabType>(() => {
    return getCurrentAthkarPeriod();
  });

  // Initialize athkar data
  useInitializeAthkar();

  // Screenshot mode: seeds morning progress + streak and forces the period.
  // Returns null outside screenshot mode so production behavior is unchanged.
  const screenshotPeriod = useAthkarLandingScreenshotSeed();

  // Check for daily reset and validate streak on mount
  const openTab = useEffectEvent(() => {
    if (activeTab !== "my-athkar") {
      setCurrentType(activeTab);
    }
    validateDailyStreak();
  });
  useEffect(() => {
    openTab();
  }, []);

  // Force the seeded period (e.g. Morning) for the screenshot capture. Only a
  // screenshot-capture build seeds one; elsewhere it stays null.
  const [seeded, setSeeded] = useState<typeof screenshotPeriod>(null);
  if (screenshotPeriod !== seeded) {
    setSeeded(screenshotPeriod);
    if (screenshotPeriod) setActiveTab(screenshotPeriod);
  }
  useEffect(() => {
    if (screenshotPeriod) setCurrentType(screenshotPeriod);
  }, [screenshotPeriod, setCurrentType]);

  const handleRequestOnboarding = useCallback(() => {
    setShowOnboarding(true);
  }, []);

  return (
    <Box flex={1}>
      {/* Tab Header */}
      <Box backgroundColor="$background">
        <HStack
          justifyContent="center"
          alignItems="center"
          paddingVertical="$2"
          paddingHorizontal="$3"
          gap="$2">
          {/* Morning Tab */}
          <Pressable
            onPress={() => {
              if (activeTab !== ATHKAR_TYPE.MORNING && playerState !== "idle") {
                athkarPlayer.stop();
              }
              setActiveTab(ATHKAR_TYPE.MORNING);
              setCurrentType(ATHKAR_TYPE.MORNING);
            }}
            role="tab"
            accessibilityLabel={t("athkar.morning")}
            accessibilityState={{ selected: activeTab === ATHKAR_TYPE.MORNING }}
            flex={1}
            minHeight={44}
            paddingVertical="$3"
            paddingHorizontal="$4"
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            backgroundColor={
              activeTab === ATHKAR_TYPE.MORNING ? "$primary" : "$backgroundSecondary"
            }>
            <HStack gap="$2" alignItems="center">
              <Icon
                as={Sun}
                size="md"
                color={
                  activeTab === ATHKAR_TYPE.MORNING ? "$typographyContrast" : "$typographySecondary"
                }
              />
              <Text
                fontWeight="500"
                color={
                  activeTab === ATHKAR_TYPE.MORNING ? "$typographyContrast" : "$typographySecondary"
                }>
                {t("athkar.morning")}
              </Text>
            </HStack>
          </Pressable>

          {/* Evening Tab */}
          <Pressable
            onPress={() => {
              if (activeTab !== ATHKAR_TYPE.EVENING && playerState !== "idle") {
                athkarPlayer.stop();
              }
              setActiveTab(ATHKAR_TYPE.EVENING);
              setCurrentType(ATHKAR_TYPE.EVENING);
            }}
            role="tab"
            accessibilityLabel={t("athkar.evening")}
            accessibilityState={{ selected: activeTab === ATHKAR_TYPE.EVENING }}
            flex={1}
            minHeight={44}
            paddingVertical="$3"
            paddingHorizontal="$4"
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            backgroundColor={
              activeTab === ATHKAR_TYPE.EVENING ? "$primary" : "$backgroundSecondary"
            }>
            <HStack gap="$2" alignItems="center">
              <Icon
                as={Moon}
                size="md"
                color={
                  activeTab === ATHKAR_TYPE.EVENING ? "$typographyContrast" : "$typographySecondary"
                }
              />
              <Text
                fontWeight="500"
                color={
                  activeTab === ATHKAR_TYPE.EVENING ? "$typographyContrast" : "$typographySecondary"
                }>
                {t("athkar.evening")}
              </Text>
            </HStack>
          </Pressable>

          {/* My Athkar Tab — only for ar/en */}
          {showMyAthkarTab && (
            <Pressable
              onPress={() => {
                if (activeTab !== "my-athkar" && playerState !== "idle") {
                  athkarPlayer.stop();
                }
                setActiveTab("my-athkar");
              }}
              role="tab"
              accessibilityLabel={t("athkar.myAthkar")}
              accessibilityState={{ selected: activeTab === "my-athkar" }}
              flex={1}
              minHeight={44}
              paddingVertical="$3"
              paddingHorizontal="$4"
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              backgroundColor={activeTab === "my-athkar" ? "$primary" : "$backgroundSecondary"}>
              <HStack gap="$2" alignItems="center">
                <Icon
                  as={BookOpen}
                  size="md"
                  color={activeTab === "my-athkar" ? "$typographyContrast" : "$typographySecondary"}
                />
                <Text
                  fontWeight="500"
                  color={
                    activeTab === "my-athkar" ? "$typographyContrast" : "$typographySecondary"
                  }>
                  {t("athkar.myAthkar")}
                </Text>
              </HStack>
            </Pressable>
          )}
        </HStack>
      </Box>

      {/* Content Area */}
      <ScrollView
        style={{ flex: 1, backgroundColor: "transparent" }}
        contentContainerStyle={{ paddingBottom: tabBarInset }}>
        <Box padding="$4">
          {activeTab === "my-athkar" ? (
            <MyAthkarList />
          ) : (
            <AthkarList type={activeTab} onRequestOnboarding={handleRequestOnboarding} />
          )}
        </Box>
      </ScrollView>

      {activeTab !== "my-athkar" && (
        <Fab
          onPress={() => router.push("/athkar-focus")}
          size="lg"
          marginBottom={tabBarInset}
          accessibilityLabel={t("athkar.focus.title")}>
          <FabIcon as={Focus} />
        </Fab>
      )}

      <AudioOnboarding isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </Box>
  );
};

export default AthkarTabs;
