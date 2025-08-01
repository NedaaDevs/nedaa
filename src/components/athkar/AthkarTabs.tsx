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

  const { setCurrentType } = useAthkarStore();

  type activeTabType = Exclude<AthkarType, "all">;

  const [activeTab, setActiveTab] = useState<activeTabType>(() => {
    // will set tab based on the time of the day
    return getCurrentAthkarPeriod();
  });

  // Initialize athkar data
  useInitializeAthkar();

  // Check for daily reset on mount
  useEffect(() => {
    setCurrentType(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box className="flex-1">
      {/* Tab Header */}
      <Box className="bg-background dark:bg-background-secondary">
        <HStack className="justify-center items-center py-2">
          {/* Morning Tab */}
          <Pressable
            onPress={() => {
              setActiveTab(ATHKAR_TYPE.MORNING);
              setCurrentType(ATHKAR_TYPE.MORNING);
            }}
            className={`flex-1 py-3 px-4 mx-2 rounded-full items-center ${
              activeTab === ATHKAR_TYPE.MORNING
                ? "bg-accent-primary"
                : "bg-background-secondary dark:bg-background-tertiary"
            }`}>
            <HStack space="sm" className="items-center">
              <Icon
                as={Sun}
                className={activeTab !== ATHKAR_TYPE.MORNING ? "text-typography-secondary" : ""}
                size="md"
              />
              <Text
                className={`font-medium ${
                  activeTab === ATHKAR_TYPE.MORNING ? "text-white" : "text-typography-secondary"
                }`}>
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
            className={`flex-1 py-3 px-4 mx-2 rounded-full items-center ${
              activeTab === ATHKAR_TYPE.EVENING
                ? "bg-accent-primary"
                : "bg-background-secondary dark:bg-background-tertiary"
            }`}>
            <HStack space="sm" className="items-center">
              <Icon
                as={Moon}
                className={activeTab !== ATHKAR_TYPE.EVENING ? "text-typography-secondary" : ""}
                size="md"
              />
              <Text
                className={`font-medium ${
                  activeTab === ATHKAR_TYPE.EVENING ? "text-white" : "text-typography-secondary"
                }`}>
                {t("athkar.evening")}
              </Text>
            </HStack>
          </Pressable>
        </HStack>
      </Box>

      {/* Content Area */}
      <ScrollView className="flex-1 bg-background">
        <Box className="p-4">
          <AthkarList type={activeTab} />
        </Box>
      </ScrollView>

      <Fab onPress={() => router.push("/athkar-focus")} size="lg" className="bg-primary ">
        <FabIcon as={Focus} color="white" />
      </Fab>
    </Box>
  );
};

export default AthkarTabs;
