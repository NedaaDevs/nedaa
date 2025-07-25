import { useTranslation } from "react-i18next";

// Components
import { Background } from "@/components/ui/background";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import TopBar from "@/components/TopBar";

// Store
import { useAthkarStore } from "@/stores/athkar";

const AthkarSettings = () => {
  const { t } = useTranslation();
  const { settings, toggleAutoMove, toggleShowStreak } = useAthkarStore();

  return (
    <Background>
      <TopBar title="settings.athkar.title" backOnClick />

      {/* Auto Move Setting */}
      {/* <VStack className="p-4" space="md">
        <Box className="bg-background-secondary dark:bg-background-tertiary rounded-xl p-4">
          <HStack className="justify-between items-center">
            <VStack className="flex-1 mr-4">
              <Text className="text-base font-medium text-typography">
                {t("settings.athkar.autoMove.title")}
              </Text>
              <Text className="text-sm text-typography-secondary mt-1">
                {t("settings.athkar.autoMove.description")}
              </Text>
            </VStack>
            <Switch
              value={settings.autoMoveToNext}
              onValueChange={toggleAutoMove}
              trackColor={{
                false: "#767577",
                true: "#6366f1",
              }}
            />
          </HStack>
        </Box>
      </VStack> */}

      <VStack className="p-4" space="md">
        {/* Show streak Setting */}
        <Box className="bg-background-secondary dark:bg-background-tertiary rounded-xl p-4">
          <HStack className="justify-between items-center">
            <VStack className="flex-1 mr-4">
              <Text className="text-base font-medium text-typography">
                {t("settings.athkar.showStreak.title")}
              </Text>
              <Text className="text-sm text-typography-secondary mt-1">
                {t("settings.athkar.showStreak.description")}
              </Text>
            </VStack>
            <Switch
              value={settings.showStreak}
              onValueChange={toggleShowStreak}
              trackColor={{
                false: "#767577",
                true: "#6366f1",
              }}
            />
          </HStack>
        </Box>
      </VStack>
    </Background>
  );
};

export default AthkarSettings;
