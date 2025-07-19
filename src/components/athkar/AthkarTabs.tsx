import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView } from "react-native";

// Components
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

// Icons
import { Sun, Moon } from "lucide-react-native";

// Types
import { AthkarType } from "@/types/athkar";

const AthkarTabs = () => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<AthkarType>(ATHKAR_TYPE.MORNING);

  return (
    <Box className="flex-1">
      {/* Tab Header */}
      <Box className="bg-background dark:bg-background-secondary">
        <HStack className="justify-center items-center py-2">
          {/* Morning Tab */}
          <Pressable
            onPress={() => setActiveTab(ATHKAR_TYPE.MORNING)}
            className={`flex-1 py-3 px-4 mx-2 rounded-full items-center ${
              activeTab === ATHKAR_TYPE.MORNING
                ? "bg-accent-primary"
                : "bg-background-secondary dark:bg-background-tertiary"
            }`}>
            <HStack space="sm" className="items-center">
              <Sun
                size={20}
                color={activeTab === ATHKAR_TYPE.MORNING ? "white" : "currentColor"}
                className={activeTab !== ATHKAR_TYPE.MORNING ? "text-typography-secondary" : ""}
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
            onPress={() => setActiveTab(ATHKAR_TYPE.EVENING)}
            className={`flex-1 py-3 px-4 mx-2 rounded-full items-center ${
              activeTab === ATHKAR_TYPE.EVENING
                ? "bg-accent-primary"
                : "bg-background-secondary dark:bg-background-tertiary"
            }`}>
            <HStack space="sm" className="items-center">
              <Moon
                size={20}
                color={activeTab === ATHKAR_TYPE.EVENING ? "white" : "currentColor"}
                className={activeTab !== ATHKAR_TYPE.EVENING ? "text-typography-secondary" : ""}
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
          <Text className="text-center text-typography-secondary">Streak & Day Progress</Text>
        </Box>
        <Box className="p-4">
          {activeTab === ATHKAR_TYPE.MORNING ? (
            <Box>
              {/* Morning athkar list */}
              <Text className="text-center text-typography-secondary">Morning Athkar Content</Text>
            </Box>
          ) : (
            <Box>
              {/* Evening athkar list  */}
              <Text className="text-center text-typography-secondary">Evening Athkar Content</Text>
            </Box>
          )}
        </Box>
      </ScrollView>
    </Box>
  );
};

export default AthkarTabs;
