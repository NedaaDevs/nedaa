import { useState, useEffect } from "react";
import { t } from "i18next";
import { ScrollView } from "react-native";

// Components
import { Box } from "@/components/ui/box";
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

const TimePicker = ({
  isVisible,
  currentHour,
  currentMinute,
  onTimeChange,
  onClose,
  isPM = false,
  use12HourFormat = false,
}: {
  isVisible: boolean;
  currentHour: number;
  currentMinute: number;
  onTimeChange: (hour: number, minute: number) => void;
  onClose: () => void;
  use12HourFormat?: boolean;
  hideTimeOption?: boolean;
  isPM?: boolean;
}) => {
  const [selectedHour, setSelectedHour] = useState(currentHour);
  const [selectedMinute, setSelectedMinute] = useState(currentMinute);

  // Update state when props change
  useEffect(() => {
    if (isVisible) {
      setSelectedHour(currentHour);
      setSelectedMinute(currentMinute);
    }
  }, [currentHour, currentMinute, isVisible]);

  const hours = use12HourFormat
    ? Array.from({ length: 12 }, (_, i) => i + 1) // 1-12 for 12-hour format
    : Array.from({ length: 24 }, (_, i) => i); // 0-23 for 24-hour format
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10, 15...55

  const displayHour = use12HourFormat ? convert24HourTo12Hour(selectedHour) : selectedHour;

  if (!isVisible) return null;

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      backgroundColor="rgba(0,0,0,0.6)"
      zIndex={50}
      justifyContent="center"
      alignItems="center"
      accessibilityRole="none">
      <Box
        backgroundColor="$backgroundSecondary"
        borderRadius="$8"
        padding="$6"
        marginHorizontal="$4"
        width={320}
        borderWidth={1}
        borderColor="$outline">
        {/* Current Time Display */}
        <Box backgroundColor="$backgroundElevated" borderRadius="$7" padding="$5" marginBottom="$6">
          <Text color="$typographyContrast" textAlign="center" size="3xl" bold>
            {use12HourFormat
              ? formatTime12Hour(selectedHour, selectedMinute)
              : formatTime24Hour(selectedHour, selectedMinute)}
          </Text>
        </Box>

        {/* Time Selectors */}
        <HStack gap="$4" justifyContent="space-between" marginBottom="$6">
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
              borderColor="$outline">
              <ScrollView
                style={{ height: 176 }}
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
                    minHeight={44}>
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
              borderColor="$outline">
              <ScrollView
                style={{ height: 176 }}
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
                    minHeight={44}>
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
      </Box>
    </Box>
  );
};

export default TimePicker;
