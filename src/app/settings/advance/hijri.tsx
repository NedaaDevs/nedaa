import { useState } from "react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

// Stores
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";

// Components
import { Background } from "@/components/ui/background";
import { Card } from "@/components/ui/card";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
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
import { ScreenHeader } from "@/components/ui/screen-header";
import { BACK_DESTINATION } from "@/constants/BackDestinations";

// Icons
import { Calendar, ChevronDown } from "lucide-react-native";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";

// Utils
import { getDateLocale, HijriNative, timeZonedNow } from "@/utils/date";
import { formatNumberToLocale } from "@/utils/number";
import { HIJRI_OFFSETS, hijriAdjustmentLabel } from "@/utils/hijriAdjustment";

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
  const todayHijri = HijriNative.today(locationDetails.timezone);
  const hijriDate =
    hijriDaysOffset !== 0 ? HijriNative.addDays(todayHijri, hijriDaysOffset) : todayHijri;

  const dayName = format(now, "EEEE", { locale: getDateLocale(locale) });

  const hijriMonth = t(`hijriMonths.${hijriDate.month - 1}`);

  const formattedDay = formatNumberToLocale(hijriDate.day.toString());
  const formattedYear = formatNumberToLocale(hijriDate.year.toString());

  const formattedDateDetails = `${formattedDay} ${hijriMonth} ${formattedYear}`;

  const adjustmentOptions: AdjustmentOption[] = HIJRI_OFFSETS.map((value) => ({
    value,
    label: hijriAdjustmentLabel(value, t),
  }));

  const handleSelectAdjustment = (value: number) => {
    hapticSelection();
    setHijirOffset(value);
    setShowActionSheet(false);
  };

  const currentAdjustmentLabel =
    adjustmentOptions.find((opt) => opt.value === hijriDaysOffset)?.label || "";

  return (
    <Background>
      <ScreenHeader
        title={t("settings.hijri.date.title")}
        back={{ fallback: BACK_DESTINATION.SETTINGS }}
      />

      <Box flex={1} padding="$4">
        <Card padding="$6" marginBottom="$6">
          <HStack
            alignItems="center"
            justifyContent="center"
            width="100%"
            marginBottom="$2"
            gap="$3">
            <Icon as={Calendar} color="$accentPrimary" size="md" />
            <VStack alignItems="center" marginVertical="$3">
              <Text size="lg" bold color="$typography">
                {dayName}
              </Text>
              <Text size="lg" bold color="$typographySecondary">
                {formattedDateDetails}
              </Text>
            </VStack>
          </HStack>
        </Card>

        <Text size="xl" fontWeight="600" color="$typography" marginBottom="$4">
          {t("settings.hijri.date.adjustmentTitle")}
        </Text>

        <Card.Pressable
          onPress={() => setShowActionSheet(true)}
          flexDirection="row"
          alignItems="center"
          accessibilityRole="button"
          accessibilityLabel={t("settings.hijri.date.selectAdjustment")}>
          <HStack justifyContent="space-between" alignItems="center" width="100%">
            <VStack>
              <Text size="sm" color="$typographySecondary" marginBottom="$1">
                {t("settings.hijri.date.currentAdjustment")}
              </Text>
              <Text color="$typography" fontWeight="500">
                {currentAdjustmentLabel}
              </Text>
            </VStack>
            <Icon as={ChevronDown} color="$typographySecondary" size="lg" />
          </HStack>
        </Card.Pressable>
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
                  <ActionsheetItemText color="$typography" fontWeight="500">
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
