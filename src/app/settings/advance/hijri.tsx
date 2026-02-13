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

        const absCount = Math.abs(i);
        const days = t("settings.hijri.date.adjustments.days", { count: absCount });
        label = `${prefix} ${formatNumberToLocale(days)}`;
      }

      options.push({
        value: i,
        label,
      });
    }

    return options;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      <Box flex={1} padding="$4">
        <Box
          backgroundColor="$backgroundSecondary"
          padding="$6"
          borderRadius="$6"
          marginBottom="$6">
          <Box flexDirection="row" alignItems="center" justifyContent="center" marginBottom="$2">
            <Icon as={Calendar} color="$accentPrimary" size="md" />
            <VStack alignItems="center" marginVertical="$3">
              <Text size="lg" bold color="$typography">
                {dayName}
              </Text>
              <Text size="lg" bold color="$typographySecondary">
                {formattedDateDetails}
              </Text>
            </VStack>
          </Box>
        </Box>

        <Text textAlign="left" size="xl" fontWeight="600" color="$typography" marginBottom="$4">
          {t("settings.hijri.date.adjustmentTitle")}
        </Text>

        <Pressable
          onPress={() => setShowActionSheet(true)}
          backgroundColor="$backgroundSecondary"
          padding="$4"
          borderRadius="$4"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between">
          <VStack>
            <Text size="sm" color="$typographySecondary" marginBottom="$1">
              {t("settings.hijri.date.currentAdjustment")}
            </Text>
            <Text textAlign="left" color="$typography" fontWeight="500">
              {currentAdjustmentLabel}
            </Text>
          </VStack>
          <Icon as={ChevronDown} color="$typographySecondary" size="lg" />
        </Pressable>
      </Box>

      <Actionsheet isOpen={showActionSheet} onClose={() => setShowActionSheet(false)}>
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
            {t("settings.hijri.date.selectAdjustment")}
          </Text>

          <ActionsheetScrollView>
            {adjustmentOptions.map((option) => {
              const isSelected = option.value === hijriDaysOffset;
              return (
                <ActionsheetItem
                  borderRadius="$6"
                  backgroundColor={isSelected ? "$backgroundMuted" : "transparent"}
                  key={option.value}
                  onPress={() => handleSelectAdjustment(option.value)}>
                  <ActionsheetItemText color="$typography" fontWeight="500" textAlign="left">
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
