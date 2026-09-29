import { useMemo } from "react";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { useRTL } from "@/contexts/RTLContext";
import { useImportantDayFormat, type DayFigure } from "@/hooks/useImportantDayFormat";
import { useLargestText } from "@/hooks/useTextScale";
import { useTodayClock } from "@/hooks/useTodayClock";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { upcomingImportantDays } from "@/utils/importantDays";

/** Test ids for the link's chevron, named by the way it points. */
export const OCCASIONS_PART = {
  CHEVRON_LEFT: "occasions-chevron-left",
  CHEVRON_RIGHT: "occasions-chevron-right",
} as const;

/** How many occasions Today lists; the link opens the rest. */
const SHOWN = 2;

/** The location's calendar day, which the list changes with. */
export const DAY_FORMAT = "yyyy-MM-dd";

// Midday stands for the whole day: a DST jump at midnight cannot move it.
const middayOf = (day: string, timezone: string) => fromZonedTime(`${day}T12:00`, timezone);

/** The days left: a number beside its unit, or one word in their place. */
const Figure = ({ value, unit }: DayFigure) =>
  unit ? (
    <HStack alignItems="baseline" gap="$1">
      <Text size="3xl" fontWeight="600" numeric color="$accent">
        {value}
      </Text>
      <Text size="sm" typography="helper" color="$muted">
        {unit}
      </Text>
    </HStack>
  ) : (
    <Text size="xl" fontWeight="600" color="$accent">
      {value}
    </Text>
  );

/** The two nearest occasions, and a link to every one. */
export const UpcomingOccasions = () => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const now = useTodayClock();
  const timezone = useLocationStore((state) => state.locationDetails.timezone);
  const hijriDaysOffset = useAppStore((state) => state.hijriDaysOffset);
  // At the largest text the figure moves under the name instead of beside it.
  const stacked = useLargestText();
  const { hijriLabel, remainingLabel, dayFigure } = useImportantDayFormat();

  // Keyed by the day, so a minute tick reuses the list.
  const day = formatInTimeZone(now, timezone, DAY_FORMAT);
  const occasions = useMemo(() => {
    const midday = middayOf(day, timezone);
    return upcomingImportantDays({ timezone, hijriDaysOffset, now: midday }).slice(0, SHOWN);
  }, [day, timezone, hijriDaysOffset]);

  if (occasions.length === 0) return null;

  return (
    <VStack borderWidth={1} borderColor="$border" borderRadius="$card" backgroundColor="$surface2">
      <HStack
        alignItems="center"
        justifyContent="space-between"
        gap="$2"
        minHeight="$target"
        paddingStart="$3"
        paddingEnd="$1"
        borderBottomWidth={1}
        borderColor="$border">
        <Text
          accessibilityRole="header"
          size="md"
          typography="helper"
          fontWeight="600"
          color="$fg"
          flexShrink={1}>
          {t("importantDays.upcoming")}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("importantDays.seeAll")}
          accessibilityHint={t("a11y.tools.opens", { name: t("importantDays.title") })}
          onPress={() => router.push(BACK_DESTINATION.IMPORTANT_DAYS.href)}
          flexDirection="row"
          alignItems="center"
          gap="$1"
          paddingHorizontal="$2"
          borderRadius="$control">
          <Text size="sm" fontWeight="600" typography="helper" color="$accent">
            {t("importantDays.seeAll")}
          </Text>
          <Box testID={isRTL ? OCCASIONS_PART.CHEVRON_LEFT : OCCASIONS_PART.CHEVRON_RIGHT}>
            <Icon as={isRTL ? ChevronLeft : ChevronRight} size="sm" color="$accent" />
          </Box>
        </Pressable>
      </HStack>
      {occasions.map((occasion, index) => {
        const name = t(occasion.i18nKey);
        const hijri = hijriLabel(occasion);
        return (
          <Box
            key={occasion.id}
            accessible
            accessibilityLabel={`${name}, ${remainingLabel(occasion.daysRemaining)}, ${hijri}`}
            flexDirection={stacked ? "column" : "row"}
            alignItems={stacked ? "flex-start" : "center"}
            gap={stacked ? "$1" : "$2.5"}
            paddingHorizontal="$3"
            paddingVertical={stacked ? "$2.5" : "$2"}
            borderTopWidth={index === 0 ? 0 : 1}
            borderColor="$border">
            <VStack flexGrow={1} flexShrink={1}>
              <Text size="lg" fontWeight="600" color="$fg">
                {name}
              </Text>
              <Text size="sm" typography="helper" color="$muted">
                {hijri}
              </Text>
            </VStack>
            <Figure {...dayFigure(occasion.daysRemaining)} />
          </Box>
        );
      })}
    </VStack>
  );
};
