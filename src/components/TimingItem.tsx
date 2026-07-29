import { useTranslation } from "react-i18next";

// Components
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";

import { Sun } from "lucide-react-native";
import { formatPrayerTime } from "@/utils/date";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
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
  const use24HourTime = usePreferencesStore((s) => s.use24HourTime);

  const formattedPrayerTime = (date: string) =>
    formatNumberToLocale(
      formatPrayerTime(date, locationDetails.timezone, { locale, use24HourTime })
    );

  return (
    <Card
      margin="$2"
      borderRadius="$4"
      overflow="hidden"
      backgroundColor={isNext ? "$primary" : "$backgroundSecondary"}
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
        <HStack alignItems="center" gap="$3" flexShrink={1}>
          <Icon as={icon || Sun} size="md" color={isNext ? "$typographyContrast" : "$primary"} />
          <Text
            size="xl"
            fontWeight={isNext ? "700" : "500"}
            color={isNext ? "$typographyContrast" : "$typography"}
            numberOfLines={1}>
            {t(name)}
          </Text>
        </HStack>

        <Text
          size="xl"
          numeric
          fontWeight={isNext ? "700" : "500"}
          color={isNext ? "$typographyContrast" : "$primary"}>
          {formattedPrayerTime(time)}
        </Text>
      </HStack>
    </Card>
  );
};

export default TimingItem;
