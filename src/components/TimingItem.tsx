import { useTranslation } from "react-i18next";

// Components
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";

import { Sun, Check } from "lucide-react-native";
import { formatPrayerTime } from "@/utils/date";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
import { formatNumberToLocale } from "@/utils/number";
import { TimingRowState } from "@/enums/prayerTimes";

interface Props {
  name: string;
  time: string;
  icon?: any;
  state?: TimingRowState;
  showDivider?: boolean;
}

// Aligns the divider with the prayer name: row padding (16) + icon (18) + gap (12).
const DIVIDER_INSET = 46;

const TimingItem = ({
  name,
  time,
  icon,
  state = TimingRowState.UPCOMING,
  showDivider = true,
}: Props) => {
  const { t } = useTranslation();

  const { locale } = useAppStore();
  const { locationDetails } = useLocationStore();
  const use24HourTime = usePreferencesStore((s) => s.use24HourTime);

  const isNext = state === TimingRowState.NEXT;
  const isDone = state === TimingRowState.DONE;

  const formattedPrayerTime = (date: string) =>
    formatNumberToLocale(
      formatPrayerTime(date, locationDetails.timezone, { locale, use24HourTime })
    );

  // State can't ride on colour alone: done rows carry a check, next rows a badge.
  // Keep those in step with the a11y label.
  const contentColor = isNext ? "$accentPrimary" : isDone ? "$typographySecondary" : "$typography";
  const weight = isNext ? "700" : isDone ? "400" : "500";
  const a11yKey = isNext ? "a11y.prayerRowNext" : isDone ? "a11y.prayerRowDone" : "a11y.prayerRow";

  return (
    <Box>
      <Box
        padding="$4"
        backgroundColor={isNext ? "$primarySubtle" : "transparent"}
        accessible={true}
        accessibilityLabel={t(a11yKey, { name: t(name), time: formattedPrayerTime(time) })}>
        {isNext && (
          <Box
            position="absolute"
            top={0}
            bottom={0}
            width={3}
            backgroundColor="$accentPrimary"
            style={{ insetInlineStart: 0 }}
          />
        )}
        <HStack justifyContent="space-between" alignItems="center" zIndex={10} width="100%">
          <HStack alignItems="center" gap="$3" flexShrink={1}>
            <Icon as={icon || Sun} size="md" color={contentColor} />
            <Text size="xl" fontWeight={weight} color={contentColor} numberOfLines={1}>
              {t(name)}
            </Text>
            {isNext && (
              <Badge size="sm" backgroundColor="$accentPrimary">
                <Badge.Text color="$typographyContrast" fontWeight="600">
                  {t("prayerTimes.next")}
                </Badge.Text>
              </Badge>
            )}
          </HStack>

          <HStack alignItems="center" gap="$2">
            <Text size="xl" numeric fontWeight={weight} color={contentColor}>
              {formattedPrayerTime(time)}
            </Text>
            {isDone && <Icon as={Check} size="sm" color="$typographySecondary" />}
          </HStack>
        </HStack>
      </Box>

      {showDivider && <Box height={1} backgroundColor="$outline" marginStart={DIVIDER_INSET} />}
    </Box>
  );
};

export default TimingItem;
