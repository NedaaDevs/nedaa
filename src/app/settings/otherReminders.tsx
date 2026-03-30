import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Background } from "@/components/ui/background";
import TopBar from "@/components/TopBar";

// Hooks
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { useHaptic } from "@/hooks/useHaptic";

// Types
import type { OtherTimingId } from "@/types/notification";

type TimingGroup = {
  titleKey: string;
  descriptionKey?: string;
  items: OtherTimingId[];
};

const TIMING_GROUPS: TimingGroup[] = [
  {
    titleKey: "notification.otherTiming.group.morning",
    descriptionKey: "notification.otherTiming.group.morning.description",
    items: ["ishraq", "duha"],
  },
  {
    titleKey: "notification.otherTiming.group.night",
    descriptionKey: "notification.otherTiming.group.night.description",
    items: ["midnight", "firstthird", "lastthird"],
  },
  {
    titleKey: "notification.otherTiming.group.fasting",
    items: ["imsak"],
  },
];

const OtherRemindersSettings = () => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");
  const { otherTimingNotifications, updateOtherTimingNotification } = useNotificationSettings();

  return (
    <Background>
      <TopBar title="notification.otherReminders" backOnClick />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}>
        <VStack flex={1} gap="$4" paddingTop="$4">
          {TIMING_GROUPS.map((group) => (
            <VStack key={group.titleKey} gap="$2">
              {/* Section Header */}
              <Text
                size="sm"
                fontWeight="600"
                color="$typographySecondary"
                paddingHorizontal="$5"
                textTransform="uppercase">
                {t(group.titleKey)}
              </Text>

              {/* Grouped Card */}
              <Box
                backgroundColor="$backgroundSecondary"
                marginHorizontal="$4"
                borderRadius="$4"
                overflow="hidden">
                {group.items.map((timingId, index) => (
                  <Box key={timingId}>
                    <HStack
                      justifyContent="space-between"
                      alignItems="center"
                      paddingHorizontal="$4"
                      paddingVertical="$3.5"
                      minHeight={52}>
                      <Text size="md" color="$typography">
                        {t(`notification.otherTiming.${timingId}.label`)}
                      </Text>
                      <Switch
                        value={otherTimingNotifications[timingId]}
                        onValueChange={(value: boolean) => {
                          hapticSelection();
                          updateOtherTimingNotification(timingId, value);
                        }}
                        accessibilityLabel={t(`notification.otherTiming.${timingId}.label`)}
                      />
                    </HStack>
                    {/* Separator between items */}
                    {index < group.items.length - 1 && (
                      <Box height={0.5} backgroundColor="$outline" marginStart="$4" />
                    )}
                  </Box>
                ))}
              </Box>

              {/* Section Footer */}
              {group.descriptionKey && (
                <Text size="xs" color="$typographySecondary" paddingHorizontal="$5">
                  {t(group.descriptionKey)}
                </Text>
              )}
            </VStack>
          ))}
        </VStack>
      </ScrollView>
    </Background>
  );
};

export default OtherRemindersSettings;
