import { useEffect, useEffectEvent, useState } from "react";
import { t } from "i18next";
import { BackHandler, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Components
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";

// Utils
import { formatTime12Hour, formatTime24Hour } from "@/utils/date";

const convert24HourTo12Hour = (hour24: number) => {
  if (hour24 === 0) return 12;
  if (hour24 > 12) return hour24 - 12;
  return hour24;
};

const convert12HourTo24Hour = (hour12: number, isPM: boolean) => {
  if (hour12 === 12) {
    return isPM ? 12 : 0;
  }
  return isPM ? hour12 + 12 : hour12;
};

// At the card's height limit the two lists shrink, down to a touch target's
// height; the row and each radio group shrink with them.
const LIST_STYLE = { height: 176, flexShrink: 1, minHeight: 44 };

export type TimePickerBodyProps = {
  /** Says which time the picker sets; the time alone does not. */
  title: string;
  currentHour: number;
  currentMinute: number;
  onTimeChange: (hour: number, minute: number) => void;
  onClose: () => void;
  use12HourFormat?: boolean;
  isPM?: boolean;
};

// The picker surface. Its selection seeds from the caller's time when it mounts and
// then belongs to the user; the gate in TimePicker remounts it for a new time.
export const TimePickerBody = ({
  title,
  currentHour,
  currentMinute,
  onTimeChange,
  onClose,
  isPM = false,
  use12HourFormat = false,
}: TimePickerBodyProps) => {
  const [selectedHour, setSelectedHour] = useState(currentHour);
  const [selectedMinute, setSelectedMinute] = useState(currentMinute);

  // Back cancels, as the Cancel button does. The listener registers once, so
  // a dialog opened above this one stays first.
  const cancel = useEffectEvent(() => onClose());
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      cancel();
      return true;
    });
    return () => subscription.remove();
  }, []);

  const hours = use12HourFormat
    ? Array.from({ length: 12 }, (_, i) => i + 1) // 1-12 for 12-hour format
    : Array.from({ length: 24 }, (_, i) => i); // 0-23 for 24-hour format
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10, 15...55

  const displayHour = use12HourFormat ? convert24HourTo12Hour(selectedHour) : selectedHour;

  // The root safe area leaves the bottom inset to each screen.
  const insets = useSafeAreaInsets();

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      paddingBottom={insets.bottom}
      backgroundColor="rgba(0,0,0,0.6)"
      zIndex={50}
      justifyContent="center"
      alignItems="center"
      accessibilityRole="none"
      accessibilityViewIsModal={true}>
      <Card
        borderRadius="$8"
        padding="$6"
        marginHorizontal="$4"
        width={320}
        maxHeight="100%"
        borderWidth={1}
        borderColor="$outline">
        <Text
          accessibilityRole="header"
          size="xl"
          bold
          color="$typography"
          textAlign="center"
          marginBottom="$4">
          {title}
        </Text>

        {/* Current Time Display */}
        <Box backgroundColor="$backgroundElevated" borderRadius="$7" padding="$5" marginBottom="$6">
          <Text color="$typographyContrast" textAlign="center" size="3xl" bold>
            {use12HourFormat
              ? formatTime12Hour(selectedHour, selectedMinute)
              : formatTime24Hour(selectedHour, selectedMinute)}
          </Text>
        </Box>

        {/* Time Selectors */}
        <HStack gap="$4" justifyContent="space-between" marginBottom="$6" flexShrink={1}>
          {/* Hour Picker */}
          <VStack flex={1}>
            <Text
              textAlign="center"
              color="$typographySecondary"
              marginBottom="$3"
              size="sm"
              fontWeight="600">
              {t("common.hourLabel")}
            </Text>
            <Box
              backgroundColor="$background"
              borderRadius="$6"
              padding="$2"
              borderWidth={1}
              borderColor="$outline"
              flexShrink={1}
              accessibilityRole="radiogroup"
              accessibilityLabel={t("common.hourLabel")}>
              <ScrollView
                style={LIST_STYLE}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4 }}>
                {hours.map((hour) => (
                  <Pressable
                    key={hour}
                    onPress={() => {
                      if (use12HourFormat) {
                        const hour24 = convert12HourTo24Hour(hour, isPM);
                        setSelectedHour(hour24);
                      } else {
                        setSelectedHour(hour);
                      }
                    }}
                    padding="$3"
                    borderRadius="$3"
                    marginBottom="$2"
                    marginHorizontal="$1"
                    minHeight={44}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: displayHour === hour }}
                    accessibilityLabel={
                      use12HourFormat ? hour.toString() : hour.toString().padStart(2, "0")
                    }>
                    <Box
                      backgroundColor={displayHour === hour ? "$primary" : "$backgroundSecondary"}
                      borderWidth={displayHour === hour ? 0 : 1}
                      borderColor="$outline"
                      borderRadius="$6"
                      padding="$3">
                      <Text
                        textAlign="center"
                        fontWeight="600"
                        size="lg"
                        color={displayHour === hour ? "$typographyContrast" : "$typography"}>
                        {use12HourFormat ? hour.toString() : hour.toString().padStart(2, "0")}
                      </Text>
                    </Box>
                  </Pressable>
                ))}
              </ScrollView>
            </Box>
          </VStack>

          {/* Minute Picker */}
          <VStack flex={1}>
            <Text
              textAlign="center"
              color="$typographySecondary"
              marginBottom="$3"
              size="sm"
              fontWeight="600">
              {t("common.minute")}
            </Text>
            <Box
              backgroundColor="$background"
              borderRadius="$6"
              padding="$2"
              borderWidth={1}
              borderColor="$outline"
              flexShrink={1}
              accessibilityRole="radiogroup"
              accessibilityLabel={t("common.minute")}>
              <ScrollView
                style={LIST_STYLE}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4 }}>
                {minutes.map((minute) => (
                  <Pressable
                    key={minute}
                    onPress={() => setSelectedMinute(minute)}
                    padding="$3"
                    borderRadius="$3"
                    marginBottom="$2"
                    marginHorizontal="$1"
                    minHeight={44}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: selectedMinute === minute }}
                    accessibilityLabel={minute.toString().padStart(2, "0")}>
                    <Box
                      backgroundColor={
                        selectedMinute === minute ? "$primary" : "$backgroundSecondary"
                      }
                      borderWidth={selectedMinute === minute ? 0 : 1}
                      borderColor="$outline"
                      borderRadius="$6"
                      padding="$3">
                      <Text
                        textAlign="center"
                        fontWeight="600"
                        size="lg"
                        color={selectedMinute === minute ? "$typographyContrast" : "$typography"}>
                        {minute.toString().padStart(2, "0")}
                      </Text>
                    </Box>
                  </Pressable>
                ))}
              </ScrollView>
            </Box>
          </VStack>
        </HStack>

        {/* Action Buttons  */}
        <VStack gap="$3" marginTop="$2">
          <Button
            onPress={() => {
              onTimeChange(selectedHour, selectedMinute);
              onClose();
            }}
            width="100%"
            backgroundColor="$primary"
            borderRadius="$6"
            borderWidth={0}>
            <Button.Text textAlign="center" color="$typographyContrast" fontWeight="600">
              {t("common.confirm")}
            </Button.Text>
          </Button>

          <Button
            onPress={onClose}
            width="100%"
            backgroundColor="$background"
            borderWidth={1}
            borderColor="$primary"
            borderRadius="$6">
            <Button.Text textAlign="center" color="$typography" fontWeight="600">
              {t("common.cancel")}
            </Button.Text>
          </Button>
        </VStack>
      </Card>
    </Box>
  );
};
