import { useTranslation } from "react-i18next";
import { useState } from "react";
import { TouchableOpacity } from "react-native";

// Components
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Divider } from "@/components/ui/divider";

import TimePicker from "@/components/TimePicker";

// Store
import { useAthkarStore } from "@/stores/athkar";
import { useNotificationStore } from "@/stores/notification";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

// Utils
import { formatTime12Hour } from "@/utils/date";

const Settings = () => {
  const { t } = useTranslation();
  const { settings, toggleShowStreak } = useAthkarStore();

  const { morningNotification, eveningNotification, updateAthkarNotificationSetting } =
    useNotificationStore();

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activeTimeType, setActiveTimeType] = useState<"morning" | "evening" | null>(null);

  const handleMorningToggle = () => {
    updateAthkarNotificationSetting({
      type: ATHKAR_TYPE.MORNING,
      enabled: !morningNotification.enabled,
      hour: morningNotification.hour,
      minute: morningNotification.minute,
    });
  };

  const handleEveningToggle = () => {
    updateAthkarNotificationSetting({
      type: ATHKAR_TYPE.EVENING,
      enabled: !eveningNotification.enabled,
      hour: eveningNotification.hour,
      minute: eveningNotification.minute,
    });
  };

  const handleTimeChange = (hour: number, minute: number) => {
    if (activeTimeType === "morning") {
      updateAthkarNotificationSetting({
        type: ATHKAR_TYPE.MORNING,
        enabled: morningNotification.enabled,
        hour,
        minute,
      });
    } else if (activeTimeType === "evening") {
      updateAthkarNotificationSetting({
        type: ATHKAR_TYPE.EVENING,
        enabled: eveningNotification.enabled,
        hour,
        minute,
      });
    }
  };

  const openTimePicker = (type: "morning" | "evening") => {
    setActiveTimeType(type);
    setShowTimePicker(true);
  };

  return (
    <>
      <VStack className="p-4" space="lg">
        {/* Notification Settings Section */}
        <VStack space="md">
          {/* Morning Athkar Notification */}
          <Box className="bg-background-secondary dark:bg-background-tertiary rounded-xl p-4">
            <VStack space="md">
              <HStack className="justify-between items-center">
                <VStack className="flex-1 mr-4">
                  <Text className="text-left text-base font-medium text-typography">
                    {t("settings.athkar.notifications.morning.title")}
                  </Text>
                </VStack>
                <Switch value={morningNotification.enabled} onValueChange={handleMorningToggle} />
              </HStack>

              {morningNotification.enabled && (
                <VStack space="sm" className="mt-3">
                  <HStack className="items-center justify-between">
                    <HStack className="items-center" space="sm">
                      <Text className="text-sm text-typography-secondary">
                        {t("settings.athkar.notifications.time")}
                      </Text>
                    </HStack>
                    <VStack>
                      <TouchableOpacity
                        onPress={() => openTimePicker("morning")}
                        className="bg-primary-500 rounded-lg px-4 py-2">
                        <Text className="font-medium text-primary rounded-lg">
                          {formatTime12Hour(
                            morningNotification.hour,
                            morningNotification.minute || 0
                          )}
                        </Text>
                      </TouchableOpacity>
                      <Text className="text-xs text-center text-primary rounded-lg">
                        {t("settings.athkar.notifications.morning.time.note")}
                      </Text>
                    </VStack>
                  </HStack>
                </VStack>
              )}
            </VStack>
          </Box>

          {/* Evening Athkar Notification */}
          <Box className="bg-background-secondary dark:bg-background-tertiary rounded-xl p-4">
            <VStack space="md">
              <HStack className="justify-between items-center">
                <VStack className="flex-1 mr-4">
                  <Text className="text-left text-base font-medium text-typography">
                    {t("settings.athkar.notifications.evening.title")}
                  </Text>
                </VStack>
                <Switch value={eveningNotification.enabled} onValueChange={handleEveningToggle} />
              </HStack>

              {eveningNotification.enabled && (
                <VStack space="sm" className="mt-3">
                  <HStack className="items-center justify-between">
                    <HStack className="items-center" space="sm">
                      <Text className="text-sm text-typography-secondary">
                        {t("settings.athkar.notifications.time")}
                      </Text>
                    </HStack>
                    <VStack>
                      <TouchableOpacity
                        onPress={() => openTimePicker("evening")}
                        className="bg-primary-500 rounded-lg px-4 py-2">
                        <Text className="text-primary font-medium">
                          {formatTime12Hour(
                            eveningNotification.hour,
                            eveningNotification.minute || 0
                          )}
                        </Text>
                        <Text className="text-xs text-center text-primary rounded-lg">
                          {t("settings.athkar.notifications.evening.time.note")}
                        </Text>
                      </TouchableOpacity>
                    </VStack>
                  </HStack>
                </VStack>
              )}
            </VStack>
          </Box>
        </VStack>

        <Divider className="my-4" />

        {/* App Settings Section */}
        <VStack space="md">
          {/* Auto Move Setting */}
          {/* <Box className="bg-background-secondary dark:bg-background-tertiary rounded-xl p-4">
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
              />
            </HStack>
          </Box> */}

          {/* Show streak Setting */}
          <Box className="bg-background-secondary  rounded-xl p-4">
            <HStack className="justify-between items-center">
              <VStack className="flex-1 mr-4">
                <Text className="text-left text-base font-medium text-typography">
                  {t("settings.athkar.showStreak.title")}
                </Text>
                <Text className="text-left text-sm text-typography-secondary mt-1">
                  {t("settings.athkar.showStreak.description")}
                </Text>
              </VStack>
              <Switch value={settings.showStreak} onValueChange={toggleShowStreak} />
            </HStack>
          </Box>
        </VStack>
      </VStack>

      <TimePicker
        isVisible={showTimePicker}
        currentHour={
          activeTimeType === "morning" ? morningNotification.hour : eveningNotification.hour
        }
        currentMinute={
          activeTimeType === "morning"
            ? morningNotification.minute || 0
            : eveningNotification.minute || 0
        }
        use12HourFormat
        hideTimeOption
        onTimeChange={handleTimeChange}
        onClose={() => {
          setShowTimePicker(false);
          setActiveTimeType(null);
        }}
      />
    </>
  );
};

export default Settings;
