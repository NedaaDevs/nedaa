import { useTranslation } from "react-i18next";

// Components
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";

import { Sun } from "lucide-react-native";
import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { getDateLocale } from "@/utils/date";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { formatNumberToLocale } from "@/utils/number";

interface Props {
  name: string;
  time: string;
  icon?: any;
  isNext?: boolean;
  showDivider?: boolean;
}

// Aligns the divider with the prayer name: row padding (16) + icon (18) + gap (12).
const DIVIDER_INSET = 46;

const TimingItem = ({ name, time, icon, isNext = false, showDivider = true }: Props) => {
  const { t } = useTranslation();

  const { locale } = useAppStore();
  const { locationDetails } = useLocationStore();

  const formattedPrayerTime = (date: string) => {
    const parsedDate = parseISO(date);

    return formatNumberToLocale(
      formatInTimeZone(parsedDate, locationDetails.timezone, "h:mm a", {
        locale: getDateLocale(locale),
      })
    );
  };

  return (
    <Box>
      <Box
        padding="$4"
        backgroundColor={isNext ? "$primarySubtle" : "transparent"}
        accessible={true}
        accessibilityLabel={
          isNext
            ? t("a11y.prayerRowNext", { name: t(name), time: formattedPrayerTime(time) })
            : t("a11y.prayerRow", { name: t(name), time: formattedPrayerTime(time) })
        }>
        {isNext && (
          <Box
            position="absolute"
            top={0}
            bottom={0}
            width={4}
            backgroundColor="$accentPrimary"
            style={{ insetInlineStart: 0 }}
          />
        )}
        <HStack justifyContent="space-between" alignItems="center" zIndex={10} width="100%">
          <HStack alignItems="center" gap="$3">
            <Icon as={icon || Sun} size="md" color={isNext ? "$accentPrimary" : "$primary"} />
            <Text
              size="xl"
              fontWeight={isNext ? "700" : "500"}
              color={isNext ? "$accentPrimary" : "$typography"}>
              {t(name)}
            </Text>
          </HStack>

          <Text
            size="xl"
            numeric
            fontWeight={isNext ? "700" : "500"}
            color={isNext ? "$accentPrimary" : "$primary"}>
            {formattedPrayerTime(time)}
          </Text>
        </HStack>
      </Box>

      {showDivider && <Box height={1} backgroundColor="$outline" marginStart={DIVIDER_INSET} />}
    </Box>
  );
};

export default TimingItem;
