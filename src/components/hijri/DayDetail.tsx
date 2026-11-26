import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { ObservanceGlyph } from "@/components/hijri/ObservanceGlyph";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { LiveRegion } from "@/components/ui/live-region";
import { useElevationShadow } from "@/components/ui/material/edge";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ELEVATION_LEVEL } from "@/constants/Elevation";
import { DETAIL_FADE_MS } from "@/constants/HijriCalendar";
import { SHEET_CURVE } from "@/constants/Motion";
import { OBSERVANCE_MARK } from "@/constants/ObservanceMarks";
import { useHijriCalendarText } from "@/hooks/useHijriCalendarText";
import { useIosAnnouncement } from "@/hooks/useIosAnnouncement";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { MonthCell } from "@/utils/hijriMonthGrid";

const ROW_GLYPH_SIZE = 20;
const CURVE = Easing.bezier(...SHEET_CURVE);

type Props = {
  cell: MonthCell;
  year: number;
  month: number;
  isToday: boolean;
  /** Says the detail as it changes; false keeps it silent, as on opening. */
  announce: boolean;
};

/** The selected day: its dates and one row per observance on it. */
export const DayDetail = ({ cell, year, month, isToday, announce }: Props) => {
  const { t } = useTranslation();
  const text = useHijriCalendarText();
  const reduceMotion = useReducedMotion();
  const lift = useElevationShadow(ELEVATION_LEVEL.E1);
  const opacity = useSharedValue(1);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  const day = cell.gregorian.getTime();

  useEffect(() => {
    if (reduceMotion) return;
    opacity.set(0);
    opacity.set(withTiming(1, { duration: DETAIL_FADE_MS, easing: CURVE }));
  }, [day, reduceMotion, opacity]);

  const title = text.dayTitle(cell, month, text.yearAh(year));
  const gregorian = text.dated(cell.gregorian, "d MMMM yyyy");
  const spoken = text.sentences([
    text.dayTitle(cell, month, text.spokenYearAh(year)),
    gregorian,
    ...(isToday ? [t("hijriCalendar.today")] : []),
    ...(cell.observances.length
      ? cell.observances.map((o) => text.sentences([text.marked(o), t(o.rulingKey)]))
      : [t("hijriCalendar.nothingMarked")]),
  ]);
  const message = announce ? spoken : null;
  useIosAnnouncement(message);

  return (
    <LiveRegion message={message}>
      <Animated.View style={fade}>
        <VStack
          padding="$cardPad"
          borderRadius="$card"
          backgroundColor="$raised"
          borderWidth={1}
          borderColor="$track"
          style={{ boxShadow: lift }}>
          <HStack alignItems="flex-start" gap="$stack">
            <VStack flex={1}>
              <Text size="2xl" bold typography="title" color="$fg">
                {title}
              </Text>
              <Text size="md" color="$muted">
                {gregorian}
              </Text>
            </VStack>
            {isToday && (
              <Box
                minHeight="$7"
                paddingHorizontal="$2.5"
                justifyContent="center"
                borderRadius="$chip"
                borderWidth={1.5}
                borderColor="$fg">
                <Text size="helper" fontWeight="600" color="$fg">
                  {t("hijriCalendar.today")}
                </Text>
              </Box>
            )}
          </HStack>
          {cell.observances.length === 0 ? (
            <Text size="label" color="$fg" marginTop="$inline">
              {t("hijriCalendar.nothingMarked")}
            </Text>
          ) : (
            cell.observances.map((observance) => (
              <HStack
                key={observance.id}
                gap="$stack"
                marginTop="$stack"
                paddingTop="$stack"
                borderTopWidth={1}
                borderColor="$track">
                <Box width="$6" paddingTop="$0.5">
                  <ObservanceGlyph
                    observanceClass={observance.observanceClass}
                    size={ROW_GLYPH_SIZE}
                  />
                </Box>
                <VStack flex={1}>
                  <Text size="helper" fontWeight="600" color="$muted">
                    {t(OBSERVANCE_MARK[observance.observanceClass].labelKey)}
                  </Text>
                  <Text size="lg" fontWeight="600" color="$fg">
                    {t(observance.nameKey)}
                  </Text>
                  <Text size="md" color="$fg" marginTop="$0.5">
                    {t(observance.rulingKey)}
                  </Text>
                </VStack>
              </HStack>
            ))
          )}
        </VStack>
      </Animated.View>
    </LiveRegion>
  );
};
