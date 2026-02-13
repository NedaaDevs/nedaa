import { useState, useEffect } from "react";
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

// Stores
import { useAthkarStore } from "@/stores/athkar";

// Hooks
import { useInitializeAthkar } from "@/hooks/useInitializeAthkar";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

// Icons
import { Sun, Moon, Focus } from "lucide-react-native";

// Types
import { AthkarType } from "@/types/athkar";

// Utils
import { getCurrentAthkarPeriod } from "@/utils/athkar";

const AthkarTabs = () => {
  const { t } = useTranslation();
  const router = useRouter();

  const { setCurrentType, validateDailyStreak } = useAthkarStore();

  type activeTabType = Exclude<AthkarType, "all">;

  const [activeTab, setActiveTab] = useState<activeTabType>(() => {
    // will set tab based on the time of the day
    return getCurrentAthkarPeriod();
  });

  // Initialize athkar data
  useInitializeAthkar();

  // Check for daily reset and validate streak on mount
  useEffect(() => {
    setCurrentType(activeTab);
    validateDailyStreak(); // Only check when athkar page opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box flex={1}>
      {/* Tab Header */}
      <Box backgroundColor="$background">
        <HStack justifyContent="center" alignItems="center" paddingVertical="$2">
          {/* Morning Tab */}
          <Pressable
            onPress={() => {
              setActiveTab(ATHKAR_TYPE.MORNING);
              setCurrentType(ATHKAR_TYPE.MORNING);
            }}
            role="tab"
            accessibilityLabel={t("athkar.morning")}
            flex={1}
            minHeight={44}
            paddingVertical="$3"
            paddingHorizontal="$4"
            marginHorizontal="$2"
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
              setActiveTab(ATHKAR_TYPE.EVENING);
              setCurrentType(ATHKAR_TYPE.EVENING);
            }}
            role="tab"
            accessibilityLabel={t("athkar.evening")}
            flex={1}
            minHeight={44}
            paddingVertical="$3"
            paddingHorizontal="$4"
            marginHorizontal="$2"
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
        </HStack>
      </Box>

      {/* Content Area */}
      <ScrollView style={{ flex: 1, backgroundColor: "transparent" }}>
        <Box padding="$4">
          <AthkarList type={activeTab} />
        </Box>
      </ScrollView>

      <Fab
        onPress={() => router.push("/athkar-focus")}
        size="lg"
        placement="bottom right"
        accessibilityLabel={t("athkar.focus.title")}>
        <FabIcon as={Focus} color="$typographyContrast" />
      </Fab>
    </Box>
  );
};

export default AthkarTabs;
