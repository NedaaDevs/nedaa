import { useTranslation } from "react-i18next";

import { Disclosure } from "@/components/ui/disclosure";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { OTHER_TIME_LABEL_KEY, OTHER_TIMING_NAMES, type OtherTimingName } from "@/constants/Prayer";
import { useShownDay } from "@/hooks/useShownDay";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { formatPrayerTime } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";
import { spokenClockTime } from "@/utils/spokenClockTime";

/** The day's times beside the prayers, folded away under one row. */
export const OtherTimes = () => {
  const { t } = useTranslation();
  const { day } = useShownDay();
  const locale = useAppStore((state) => state.locale);
  const use24HourTime = usePreferencesStore((state) => state.use24HourTime);
  const western = usePreferencesStore((state) => state.useWesternNumerals);

  if (!day) return null;

  const item = (name: OtherTimingName) => {
    const label = t(OTHER_TIME_LABEL_KEY[name]);
    const time = localizeDigits(
      formatPrayerTime(day.otherTimings[name], day.timezone, { locale, use24HourTime }),
      locale,
      western
    );
    const spoken = spokenClockTime(
      day.otherTimings[name],
      day.timezone,
      { locale, use24HourTime, western },
      t
    );
    return (
      <HStack
        key={name}
        flex={1}
        accessible
        accessibilityLabel={`${label}, ${spoken}`}
        alignItems="center"
        justifyContent="space-between"
        gap="$1.5"
        minHeight="$8"
        borderTopWidth={1}
        borderColor="$border">
        <Text size="md" typography="helper" color="$mutedSky" flexShrink={1}>
          {label}
        </Text>
        <Text size="md" fontWeight="600" numeric color="$fg">
          {time}
        </Text>
      </HStack>
    );
  };

  // Two columns, three rows, in the order the day brings them.
  const rows = [0, 2, 4].map((start) => OTHER_TIMING_NAMES.slice(start, start + 2));
  return (
    <Disclosure title={t("otherTimings.title")}>
      <VStack paddingBottom="$2">
        {rows.map((row) => (
          <HStack key={row[0]} gap="$3">
            {row.map(item)}
          </HStack>
        ))}
      </VStack>
    </Disclosure>
  );
};
