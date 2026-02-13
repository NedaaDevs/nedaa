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
}

const TimingItem = ({ name, time, icon, isNext = false }: Props) => {
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
    <Box
      margin="$2"
      padding="$4"
      borderRadius="$4"
      backgroundColor={isNext ? "$primary" : "$backgroundSecondary"}>
      {isNext && (
        <Box
          position="absolute"
          top={0}
          bottom={0}
          width={4}
          backgroundColor="$accentPrimary"
          borderTopStartRadius="$4"
          borderBottomStartRadius="$4"
          style={{ insetInlineStart: 0 }}
        />
      )}
      <HStack justifyContent="space-between" alignItems="center" zIndex={10}>
        <HStack alignItems="center" gap="$3" flex={1} flexShrink={1}>
          <Box flexShrink={0}>
            <Icon as={icon || Sun} size="md" color={isNext ? "$typographyContrast" : "$primary"} />
          </Box>

          <Text
            size="xl"
            fontWeight={isNext ? "700" : "500"}
            color={isNext ? "$typographyContrast" : "$typography"}
            flexShrink={1}>
            {t(name)}
          </Text>
        </HStack>

        <Text
          size="xl"
          fontWeight={isNext ? "700" : "500"}
          color={isNext ? "$typographyContrast" : "$primary"}
          flexShrink={0}>
          {formattedPrayerTime(time)}
        </Text>
      </HStack>
    </Box>
  );
};

export default TimingItem;
