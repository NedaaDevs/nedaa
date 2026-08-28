import { useTranslation } from "react-i18next";
import { format } from "date-fns";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";

import { ObservanceClass } from "@/enums/observances";
import type { MonthCell } from "@/utils/hijriMonthGrid";
import { formatNumberToLocale } from "@/utils/number";
import { getDateLocale } from "@/utils/date";
import { useAppStore } from "@/stores/app";

// Values stay literal tokens: a widened string is not assignable to Tamagui's
// backgroundColor type.
const BULLET_COLOR: Record<string, "$success" | "$error" | "$accentPrimary"> = {
  [ObservanceClass.RECOMMENDED_FAST]: "$success",
  [ObservanceClass.FASTING_FORBIDDEN]: "$error",
  [ObservanceClass.NIGHT_WORSHIP]: "$accentPrimary",
  [ObservanceClass.BLESSED_DAY]: "$accentPrimary",
};

type DayObservanceSheetProps = {
  cell: MonthCell | null;
  hijriMonth: number;
  hijriYear: number;
  onClose: () => void;
};

const DayObservanceSheet = ({ cell, hijriMonth, hijriYear, onClose }: DayObservanceSheetProps) => {
  const { t } = useTranslation();
  const locale = useAppStore((s) => s.locale);

  return (
    <Actionsheet isOpen={cell !== null} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {cell && (
          <ActionsheetScrollView>
            <VStack paddingHorizontal="$4" paddingBottom="$4" gap="$1">
              <Text size="xl" fontWeight="700" color="$typography" accessibilityRole="header">
                {`${formatNumberToLocale(String(cell.hijriDay))} ${t(
                  `hijriMonths.${hijriMonth - 1}`
                )} ${formatNumberToLocale(String(hijriYear))}`}
              </Text>
              <Text size="sm" color="$typographySecondary">
                {formatNumberToLocale(
                  format(cell.gregorian, "EEEE, d MMMM yyyy", { locale: getDateLocale(locale) })
                )}
              </Text>
            </VStack>

            <VStack paddingHorizontal="$4" gap="$0">
              {cell.observances.map((observance, index) => (
                <HStack
                  key={observance.id}
                  gap="$3"
                  paddingVertical="$3"
                  borderTopWidth={index === 0 ? 0 : 1}
                  borderTopColor="$backgroundMuted">
                  <Box
                    width={8}
                    height={8}
                    marginTop="$1.5"
                    borderRadius="$10"
                    backgroundColor={BULLET_COLOR[observance.observanceClass]}
                  />
                  <VStack flex={1} gap="$1">
                    <Text size="md" fontWeight="600" color="$typography">
                      {t(observance.nameKey)}
                    </Text>
                    <Text size="sm" color="$typographySecondary">
                      {t(observance.rulingKey)}
                    </Text>
                  </VStack>
                </HStack>
              ))}
            </VStack>

            <Text
              size="xs"
              color="$typographySecondary"
              paddingHorizontal="$4"
              paddingVertical="$4">
              {t("tools.hijriConverter.disclaimer")}
            </Text>
          </ActionsheetScrollView>
        )}
      </ActionsheetContent>
    </Actionsheet>
  );
};

export default DayObservanceSheet;
