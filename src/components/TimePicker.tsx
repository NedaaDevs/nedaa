import { useState, useEffect } from "react";
import { t } from "i18next";
import { ScrollView, TouchableOpacity } from "react-native";

// Components
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Button, ButtonText } from "@/components/ui/button";

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
    <Box className="absolute inset-0 bg-black/60 z-50 justify-center items-center">
      <Box className="bg-background-secondary rounded-3xl p-6 mx-4 w-80 border border-border-subtle">
        {/* Current Time Display */}
        <Box className="bg-background-elevated rounded-2xl p-5 mb-6">
          <Text className="text-typography-contrast text-center text-3xl font-bold tracking-wider">
            {use12HourFormat
              ? formatTime12Hour(selectedHour, selectedMinute)
              : formatTime24Hour(selectedHour, selectedMinute)}
          </Text>
        </Box>

        {/* Time Selectors */}
        <HStack space="lg" className="justify-between mb-6">
          {/* Hour Picker */}
          <VStack className="flex-1">
            <Text className="text-center text-typography-secondary mb-3 text-sm font-semibold uppercase tracking-wide">
              {t("common.hour")}
            </Text>
            <Box className="bg-background rounded-xl p-2 border border-border-subtle">
              <ScrollView
                className="h-44"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4 }}>
                {hours.map((hour) => (
                  <TouchableOpacity
                    key={hour}
                    onPress={() => {
                      if (use12HourFormat) {
                        const hour24 = convert12HourTo24Hour(hour, isPM);
                        setSelectedHour(hour24);
                      } else {
                        setSelectedHour(hour);
                      }
                    }}
                    className={`p-3 rounded-xl mb-2 mx-1 transition-all duration-200  ${
                      displayHour === hour
                        ? "bg-primary"
                        : "bg-background-secondary border border-border-subtle hover:bg-surface-hover"
                    }`}>
                    <Text
                      className={`text-center font-semibold text-lg ${
                        displayHour === hour ? "text-typography-contrast" : "text-typography"
                      }`}>
                      {use12HourFormat ? hour.toString() : hour.toString().padStart(2, "0")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Box>
          </VStack>

          {/* Minute Picker */}
          <VStack className="flex-1">
            <Text className="text-center text-typography-secondary mb-3 text-sm font-semibold uppercase tracking-wide">
              {t("common.minute")}
            </Text>
            <Box className="bg-background rounded-xl p-2 border border-border-subtle">
              <ScrollView
                className="h-44"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 4 }}>
                {minutes.map((minute) => (
                  <TouchableOpacity
                    key={minute}
                    onPress={() => setSelectedMinute(minute)}
                    className={`p-3 rounded-xl mb-2 mx-1 transition-all duration-200 ${
                      selectedMinute === minute
                        ? "bg-primary"
                        : "bg-background-secondary border border-border-subtle hover:bg-surface-hover"
                    }`}>
                    <Text
                      className={`text-center font-semibold text-lg ${
                        selectedMinute === minute ? "text-typography-contrast" : "text-typography"
                      }`}>
                      {minute.toString().padStart(2, "0")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Box>
          </VStack>
        </HStack>

        {/* Action Buttons  */}
        <VStack space="md" className="mt-2">
          <Button
            onPress={() => {
              onTimeChange(selectedHour, selectedMinute);
              onClose();
            }}
            className="w-full bg-primary rounded-xl border-0">
            <ButtonText className="text-center text-typography-contrast font-semibold text-base">
              {t("common.confirm")}
            </ButtonText>
          </Button>

          <Button
            onPress={onClose}
            className="w-full bg-background border border-border-primary rounded-xl">
            <ButtonText className="text-center text-typography font-semibold text-base">
              {t("common.cancel")}
            </ButtonText>
          </Button>
        </VStack>
      </Box>
    </Box>
  );
};

export default TimePicker;
