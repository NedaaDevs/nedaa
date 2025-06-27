import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

// Stores
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";

// Components
import { Background } from "@/components/ui/background";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Icon } from "@/components/ui/icon";
import { VStack } from "@/components/ui/vstack";
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
import TopBar from "@/components/TopBar";

// Icons
import { Calendar, ChevronDown } from "lucide-react-native";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

// Utils
import { getDateLocale, HijriConverter, timeZonedNow } from "@/utils/date";
import { formatNumberToLocale } from "@/utils/number";

type AdjustmentOption = {
  value: number;
  label: string;
};

const HijriSettings = () => {
  const { t } = useTranslation();
  const { locale, hijriDaysOffset, setHijirOffset } = useAppStore();
  const { locationDetails } = useLocationStore();

  const hapticSelection = useHaptic("selection");
  const [showActionSheet, setShowActionSheet] = useState(false);

  const now = timeZonedNow(locationDetails.timezone);
  const hijriDate = HijriConverter.toHijri(now, hijriDaysOffset);

  const dayName = format(now, "EEEE", { locale: getDateLocale(locale) });

  const hijriMonth = t(`hijriMonths.${hijriDate.month - 1}`);

  const formattedDay = formatNumberToLocale(hijriDate.day.toString());
  const formattedYear = formatNumberToLocale(hijriDate.year.toString());

  const formattedDateDetails = `${formattedDay} ${hijriMonth} ${formattedYear}`;

  const adjustmentOptions: AdjustmentOption[] = useMemo(() => {
    const options: AdjustmentOption[] = [];

    // Generate options from -5 to +5
    for (let i = -5; i <= 5; i++) {
      let label: string;

      if (i === 0) {
        label = t("settings.hijri.date.adjustments.noAdjustment");
      } else {
        const prefix =
          i < 0
            ? t("settings.hijri.date.adjustments.minus")
            : t("settings.hijri.date.adjustments.plus");

        const days = t("settings.hijri.date.adjustments.days", { count: i });
        label = `${prefix} ${formatNumberToLocale(days)}`;
      }

      options.push({
        value: i,
        label,
      });
    }

    return options;
  }, [locale, t]);

  const handleSelectAdjustment = (value: number) => {
    hapticSelection();
    setHijirOffset(value);
    setShowActionSheet(false);
  };

  const currentAdjustmentLabel =
    adjustmentOptions.find((opt) => opt.value === hijriDaysOffset)?.label || "";

  return (
    <Background>
      <TopBar title={t("settings.hijri.date.title")} href="/" backOnClick />

      <Box className="flex-1 p-4">
        <Box
          className="bg-background-secondary p-6 rounded-xl mb-6"
          accessibilityRole="text"
          accessibilityLabel={t("accessibility.currentHijriDate", {
            date: `${dayName}, ${formattedDateDetails}`,
          })}>
          <Box className="flex-row items-center justify-center mb-2">
            <Icon as={Calendar} className="text-accent-primary mr-2" size="md" />
            <VStack className="items-center my-3">
              <Text className="text-lg font-bold text-typography">{dayName}</Text>
              <Text className="text-lg font-bold text-typography-secondary">
                {formattedDateDetails}
              </Text>
            </VStack>
          </Box>
        </Box>

        <Text className="text-left text-xl font-semibold text-typography mb-4">
          {t("settings.hijri.date.adjustmentTitle")}
        </Text>

        <Pressable
          onPress={() => setShowActionSheet(true)}
          className="bg-background-secondary p-4 rounded-lg flex-row items-center justify-between"
          accessibilityRole="button"
          accessibilityLabel={t("accessibility.hijriAdjustmentSelector")}
          accessibilityHint={t("accessibility.selectHijriDateAdjustment")}
          accessibilityValue={{ text: currentAdjustmentLabel }}>
          <VStack>
            <Text className="text-sm text-typography-secondary mb-1">
              {t("settings.hijri.date.currentAdjustment")}
            </Text>
            <Text className="text-left !text-typography font-medium">{currentAdjustmentLabel}</Text>
          </VStack>
          <Icon as={ChevronDown} className="text-typography-secondary" size="lg" />
        </Pressable>
      </Box>

      <Actionsheet isOpen={showActionSheet} onClose={() => setShowActionSheet(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <Text
            className="text-lg font-semibold text-typography px-4 py-3"
            accessibilityRole="header">
            {t("settings.hijri.date.selectAdjustment")}
          </Text>

          <ActionsheetScrollView>
            {adjustmentOptions.map((option) => {
              const isSelected = option.value === hijriDaysOffset;
              return (
                <ActionsheetItem
                  className={`rounded-xl ${isSelected ? "bg-surface-active" : ""}`}
                  key={option.value}
                  onPress={() => handleSelectAdjustment(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={t("accessibility.hijriAdjustmentOption", {
                    adjustment: option.label,
                  })}
                  accessibilityHint={
                    isSelected
                      ? t("accessibility.currentAdjustment")
                      : t("accessibility.selectThisAdjustment")
                  }>
                  <ActionsheetItemText className="text-left text-typography font-medium">
                    {option.label}
                  </ActionsheetItemText>
                </ActionsheetItem>
              );
            })}
          </ActionsheetScrollView>
        </ActionsheetContent>
      </Actionsheet>
    </Background>
  );
};

export default HijriSettings;
