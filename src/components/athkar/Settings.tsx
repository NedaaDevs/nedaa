import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Pressable } from "@/components/ui/pressable";

// Components
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Divider } from "@/components/ui/divider";
import { Icon } from "@/components/ui/icon";
import { Volume2, ChevronRight } from "lucide-react-native";

import TimePicker from "@/components/TimePicker";

// Store
import { useAthkarStore } from "@/stores/athkar";
import { useNotificationStore } from "@/stores/notification";

// Constants
import { ATHKAR_TYPE } from "@/constants/Athkar";

// Utils
import { formatTime12Hour } from "@/utils/date";

// Contexts
import { useRTL } from "@/contexts/RTLContext";

const Settings = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { isRTL } = useRTL();
  const isArabic = i18n.language === "ar";
  const { settings, shortVersion, toggleShowStreak, toggleShowTranslation, toggleShortVersion } =
    useAthkarStore();

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
      <VStack padding="$4" gap="$4">
        {/* Notification Settings Section */}
        <VStack gap="$3">
          {/* Morning Athkar Notification */}
          <Box backgroundColor="$backgroundSecondary" borderRadius="$6" padding="$4">
            <VStack gap="$3">
              <HStack justifyContent="space-between" alignItems="center">
                <VStack flex={1} marginEnd="$4">
                  <Text fontWeight="500" color="$typography">
                    {t("settings.athkar.notifications.morning.title")}
                  </Text>
                </VStack>
                <Switch value={morningNotification.enabled} onValueChange={handleMorningToggle} />
              </HStack>

              {morningNotification.enabled && (
                <VStack gap="$2" marginTop="$3">
                  <HStack alignItems="center" justifyContent="space-between">
                    <HStack alignItems="center" gap="$2">
                      <Text size="sm" color="$typographySecondary">
                        {t("settings.athkar.notifications.time")}
                      </Text>
                    </HStack>
                    <VStack>
                      <Pressable
                        onPress={() => openTimePicker("morning")}
                        accessibilityLabel={t("settings.athkar.notifications.time")}
                        borderRadius="$2"
                        paddingHorizontal="$4"
                        minHeight={44}
                        justifyContent="center"
                        alignItems="center">
                        <Text fontWeight="500" color="$primary">
                          {formatTime12Hour(
                            morningNotification.hour,
                            morningNotification.minute || 0
                          )}
                        </Text>
                      </Pressable>
                      <Text size="xs" textAlign="center" color="$primary">
                        {t("settings.athkar.notifications.morning.time.note")}
                      </Text>
                    </VStack>
                  </HStack>
                </VStack>
              )}
            </VStack>
          </Box>

          {/* Evening Athkar Notification */}
          <Box backgroundColor="$backgroundSecondary" borderRadius="$6" padding="$4">
            <VStack gap="$3">
              <HStack justifyContent="space-between" alignItems="center">
                <VStack flex={1} marginEnd="$4">
                  <Text fontWeight="500" color="$typography">
                    {t("settings.athkar.notifications.evening.title")}
                  </Text>
                </VStack>
                <Switch value={eveningNotification.enabled} onValueChange={handleEveningToggle} />
              </HStack>

              {eveningNotification.enabled && (
                <VStack gap="$2" marginTop="$3">
                  <HStack alignItems="center" justifyContent="space-between">
                    <HStack alignItems="center" gap="$2">
                      <Text size="sm" color="$typographySecondary">
                        {t("settings.athkar.notifications.time")}
                      </Text>
                    </HStack>
                    <VStack>
                      <Pressable
                        onPress={() => openTimePicker("evening")}
                        accessibilityLabel={t("settings.athkar.notifications.time")}
                        borderRadius="$2"
                        paddingHorizontal="$4"
                        minHeight={44}
                        justifyContent="center"
                        alignItems="center">
                        <Text color="$primary" fontWeight="500">
                          {formatTime12Hour(
                            eveningNotification.hour,
                            eveningNotification.minute || 0
                          )}
                        </Text>
                      </Pressable>
                      <Text size="xs" textAlign="center" color="$primary">
                        {t("settings.athkar.notifications.evening.time.note")}
                      </Text>
                    </VStack>
                  </HStack>
                </VStack>
              )}
            </VStack>
          </Box>
        </VStack>

        <Divider marginVertical="$4" />

        {/* App Settings Section */}
        <VStack gap="$3">
          {/* Auto Move Setting */}
          {/* <Box backgroundColor="$backgroundSecondary" borderRadius="$6" padding="$4">
            <HStack justifyContent="space-between" alignItems="center">
              <VStack flex={1} marginEnd="$4">
                <Text fontWeight="500" color="$typography">
                  {t("settings.athkar.autoMove.title")}
                </Text>
                <Text size="sm" color="$typographySecondary" marginTop="$1">
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
          <Box backgroundColor="$backgroundSecondary" borderRadius="$6" padding="$4">
            <HStack justifyContent="space-between" alignItems="center">
              <VStack flex={1} marginEnd="$4">
                <Text fontWeight="500" color="$typography">
                  {t("settings.athkar.showStreak.title")}
                </Text>
                <Text size="sm" color="$typographySecondary" marginTop="$1">
                  {t("settings.athkar.showStreak.description")}
                </Text>
              </VStack>
              <Switch value={settings.showStreak} onValueChange={toggleShowStreak} />
            </HStack>
          </Box>

          {/* Show Translation Setting — only for non-Arabic locales */}
          {!isArabic && (
            <Box backgroundColor="$backgroundSecondary" borderRadius="$6" padding="$4">
              <HStack justifyContent="space-between" alignItems="center">
                <VStack flex={1} marginEnd="$4">
                  <Text fontWeight="500" color="$typography">
                    {t("settings.athkar.showTranslation.title")}
                  </Text>
                  <Text size="sm" color="$typographySecondary" marginTop="$1">
                    {t("settings.athkar.showTranslation.description")}
                  </Text>
                </VStack>
                <Switch value={settings.showTranslation} onValueChange={toggleShowTranslation} />
              </HStack>
            </Box>
          )}

          {/* Enable short version Setting */}
          <Box backgroundColor="$backgroundSecondary" borderRadius="$6" padding="$4">
            <HStack justifyContent="space-between" alignItems="center">
              <VStack flex={1} marginEnd="$4">
                <Text fontWeight="500" color="$typography">
                  {t("settings.athkar.shortVersion.title")}
                </Text>
                <Text size="sm" color="$typographySecondary" marginTop="$1">
                  {t("settings.athkar.shortVersion.description", {
                    thikir: t("athkar.items.laIlahaIllaAllahFull"),
                    count: 100,
                    shortCount: 10,
                  })}
                </Text>
              </VStack>
              <Switch value={shortVersion} onValueChange={toggleShortVersion} />
            </HStack>
          </Box>
        </VStack>
      </VStack>

      {/* Audio Settings Link */}
      <VStack padding="$4" gap="$3">
        <Divider />
        <Pressable
          onPress={() => router.push("/settings/athkar-audio" as any)}
          backgroundColor="$backgroundSecondary"
          borderRadius="$6"
          padding="$4">
          <HStack justifyContent="space-between" alignItems="center">
            <HStack alignItems="center" gap="$3" flex={1}>
              <Icon as={Volume2} size="md" color="$primary" />
              <VStack flex={1}>
                <Text fontWeight="500" color="$typography">
                  {t("settings.athkarAudio.title")}
                </Text>
                <Text size="sm" color="$typographySecondary">
                  {t("settings.athkarAudio.description")}
                </Text>
              </VStack>
            </HStack>
            <Icon
              as={ChevronRight}
              size="md"
              color="$typographySecondary"
              style={isRTL ? { transform: [{ rotate: "180deg" }] } : undefined}
            />
          </HStack>
        </Pressable>
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
        isPM={activeTimeType === "evening"}
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
