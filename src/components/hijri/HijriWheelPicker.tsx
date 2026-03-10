import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { HijriNative, type HijriDate } from "@/utils/date";
import { formatNumberToLocale } from "@/utils/number";
import { useHaptic } from "@/hooks/useHaptic";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";

import { ChevronDown } from "lucide-react-native";

type ActiveSheet = "day" | "month" | "year" | null;

type HijriWheelPickerProps = {
  value: HijriDate;
  onChange: (date: HijriDate) => void;
};

const YEAR_MIN = 1400;
const YEAR_MAX = 1500;

const HijriWheelPicker = ({ value, onChange }: HijriWheelPickerProps) => {
  const { t } = useTranslation();
  const hapticSelection = useHaptic("selection");
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);

  const daysInMonth = useMemo(
    () => HijriNative.getDaysInMonth(value.month, value.year),
    [value.month, value.year]
  );

  const dayOptions = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }, [daysInMonth]);

  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: t(`hijriMonths.${i}`),
    }));
  }, [t]);

  const yearOptions = useMemo(() => {
    return Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);
  }, []);

  const formattedDay = formatNumberToLocale(value.day.toString());
  const formattedYear = formatNumberToLocale(value.year.toString());
  const currentMonthLabel = t(`hijriMonths.${value.month - 1}`);

  const clampDay = useCallback((day: number, month: number, year: number) => {
    const max = HijriNative.getDaysInMonth(month, year);
    return Math.min(day, max);
  }, []);

  const handleDaySelect = useCallback(
    (day: number) => {
      hapticSelection();
      onChange({ ...value, day });
      setActiveSheet(null);
    },
    [hapticSelection, onChange, value]
  );

  const handleMonthSelect = useCallback(
    (month: number) => {
      hapticSelection();
      const day = clampDay(value.day, month, value.year);
      onChange({ ...value, month, day });
      setActiveSheet(null);
    },
    [hapticSelection, onChange, value, clampDay]
  );

  const handleYearSelect = useCallback(
    (year: number) => {
      hapticSelection();
      const day = clampDay(value.day, value.month, year);
      onChange({ ...value, year, day });
      setActiveSheet(null);
    },
    [hapticSelection, onChange, value, clampDay]
  );

  return (
    <>
      <HStack gap="$3">
        <Pressable
          flex={1}
          onPress={() => setActiveSheet("day")}
          backgroundColor="$backgroundSecondary"
          padding="$3"
          borderRadius="$4"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          accessibilityRole="button"
          accessibilityLabel={t("tools.hijriConverter.day") + ": " + formattedDay}>
          <Text color="$typography" fontWeight="500">
            {formattedDay}
          </Text>
          <Icon as={ChevronDown} color="$typographySecondary" size="sm" />
        </Pressable>

        <Pressable
          flex={2}
          onPress={() => setActiveSheet("month")}
          backgroundColor="$backgroundSecondary"
          padding="$3"
          borderRadius="$4"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          accessibilityRole="button"
          accessibilityLabel={t("tools.hijriConverter.month") + ": " + currentMonthLabel}>
          <Text color="$typography" fontWeight="500">
            {currentMonthLabel}
          </Text>
          <Icon as={ChevronDown} color="$typographySecondary" size="sm" />
        </Pressable>

        <Pressable
          flex={1}
          onPress={() => setActiveSheet("year")}
          backgroundColor="$backgroundSecondary"
          padding="$3"
          borderRadius="$4"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          accessibilityRole="button"
          accessibilityLabel={t("tools.hijriConverter.year") + ": " + formattedYear}>
          <Text color="$typography" fontWeight="500">
            {formattedYear}
          </Text>
          <Icon as={ChevronDown} color="$typographySecondary" size="sm" />
        </Pressable>
      </HStack>

      <Actionsheet isOpen={activeSheet === "day"} onClose={() => setActiveSheet(null)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <Text
            size="lg"
            fontWeight="600"
            color="$typography"
            paddingHorizontal="$4"
            paddingVertical="$3">
            {t("tools.hijriConverter.day")}
          </Text>
          <ActionsheetScrollView>
            {dayOptions.map((day) => {
              const isSelected = day === value.day;
              return (
                <ActionsheetItem
                  borderRadius="$6"
                  backgroundColor={isSelected ? "$backgroundMuted" : "transparent"}
                  key={day}
                  onPress={() => handleDaySelect(day)}>
                  <ActionsheetItemText color="$typography" fontWeight="500">
                    {formatNumberToLocale(day.toString())}
                  </ActionsheetItemText>
                </ActionsheetItem>
              );
            })}
          </ActionsheetScrollView>
        </ActionsheetContent>
      </Actionsheet>

      <Actionsheet isOpen={activeSheet === "month"} onClose={() => setActiveSheet(null)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <Text
            size="lg"
            fontWeight="600"
            color="$typography"
            paddingHorizontal="$4"
            paddingVertical="$3">
            {t("tools.hijriConverter.month")}
          </Text>
          <ActionsheetScrollView>
            {monthOptions.map((option) => {
              const isSelected = option.value === value.month;
              return (
                <ActionsheetItem
                  borderRadius="$6"
                  backgroundColor={isSelected ? "$backgroundMuted" : "transparent"}
                  key={option.value}
                  onPress={() => handleMonthSelect(option.value)}>
                  <ActionsheetItemText color="$typography" fontWeight="500">
                    {option.label}
                  </ActionsheetItemText>
                </ActionsheetItem>
              );
            })}
          </ActionsheetScrollView>
        </ActionsheetContent>
      </Actionsheet>

      <Actionsheet isOpen={activeSheet === "year"} onClose={() => setActiveSheet(null)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <Text
            size="lg"
            fontWeight="600"
            color="$typography"
            paddingHorizontal="$4"
            paddingVertical="$3">
            {t("tools.hijriConverter.year")}
          </Text>
          <ActionsheetScrollView>
            {yearOptions.map((year) => {
              const isSelected = year === value.year;
              return (
                <ActionsheetItem
                  borderRadius="$6"
                  backgroundColor={isSelected ? "$backgroundMuted" : "transparent"}
                  key={year}
                  onPress={() => handleYearSelect(year)}>
                  <ActionsheetItemText color="$typography" fontWeight="500">
                    {formatNumberToLocale(year.toString())}
                  </ActionsheetItemText>
                </ActionsheetItem>
              );
            })}
          </ActionsheetScrollView>
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
};

export default HijriWheelPicker;
