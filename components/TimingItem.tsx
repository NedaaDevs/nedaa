import { useTranslation } from "react-i18next";

// Components
import { HStack } from "@/components/ui/hstack";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Icon, SunIcon } from "@/components/ui/icon";

import { parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { getDateLocale } from "@/utils/date";
import useAppStore from "@/stores/app";
import useLocationStore from "@/stores/location";
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
      className={`relative inset-0 m-2 p-4 rounded-lg overflow-hidden dark:bg-gray-800 ${isNext ? "bg-outline" : " bg-white"}`}>
      {/* Side indicator  */}
      {isNext && <Box className="absolute top-0 bottom-0 start-0 w-1 bg-secondary" />}
      <HStack className="justify-between items-center relative z-10">
        <HStack className="items-center space-x-3">
          <Box className="flex-none">
            <Icon
              as={icon || SunIcon}
              size="md"
              className={
                isNext
                  ? "font-bold text-secondary"
                  : "font-medium text-typography dark:text-tertiary"
              }
            />
          </Box>

          <Text
            className={`mx-2 text-lg font-medium ${isNext ? "text-secondary font-bold" : "text-typography dark:text-tertiary"}`}>
            {t(name)}
          </Text>
        </HStack>

        <Text
          className={`text-lg  ${isNext ? "text-secondary font-bold" : "font-medium text-typography dark:text-tertiary"}`}>
          {formattedPrayerTime(time)}
        </Text>
      </HStack>
    </Box>
  );
};

export default TimingItem;
