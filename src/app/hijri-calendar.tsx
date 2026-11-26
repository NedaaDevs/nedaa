import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Info,
  SlidersHorizontal,
} from "lucide-react-native";

import { DayDetail } from "@/components/hijri/DayDetail";
import { HijriMonthGrid } from "@/components/hijri/HijriMonthGrid";
import { ObservanceGlyph } from "@/components/hijri/ObservanceGlyph";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { ScreenContent } from "@/components/ui/screen-content";
import { ScreenHeader } from "@/components/ui/screen-header";
import { ScreenSky, SkyOccluder, SkyScrollView } from "@/components/ui/sky-background";
import { Box } from "@/components/ui/box";
import { isCursiveLocale, Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { HIJRI_YEAR_MAX, HIJRI_YEAR_MIN } from "@/constants/Hijri";
import { MONTH_CHANGE_MS, MONTH_SLIDE, NAV_ICON_SIZE } from "@/constants/HijriCalendar";
import { SHEET_CURVE } from "@/constants/Motion";
import { MARK_ORDER, OBSERVANCE_MARK } from "@/constants/ObservanceMarks";
import { MONTH_NOTES } from "@/constants/Observances";
import { useRTL } from "@/contexts/RTLContext";
import { useHaptic } from "@/hooks/useHaptic";
import { useHijriCalendarText } from "@/hooks/useHijriCalendarText";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useTodayClock } from "@/hooks/useTodayClock";
import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import { usePreferencesStore } from "@/stores/preferences";
import { HijriNative } from "@/utils/date";
import { HIJRI_NO_OFFSET, hijriAdjustmentLabel } from "@/utils/hijriAdjustment";
import {
  buildMonthGrid,
  clampHijriMonth,
  hijriMonthIndex,
  stepMonth,
  type HijriYearMonth,
  type MonthCell,
} from "@/utils/hijriMonthGrid";
import { isWeekly, monthWeeklyObservances } from "@/utils/observances";

type PickedDay = HijriYearMonth & { day: number };

const CURVE = Easing.bezier(...SHEET_CURVE);
const LEGEND_GLYPH_SIZE = 16;

const sameMonth = (a: HijriYearMonth, b: HijriYearMonth) =>
  a.year === b.year && a.month === b.month;

/** One Hijri month at a time, its marks, and the selected day. */
const HijriCalendarScreen = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isRTL } = useRTL();
  const text = useHijriCalendarText();
  const reduceMotion = useReducedMotion();
  const selectionHaptic = useHaptic(HAPTIC_FEEDBACK.SELECTION);
  const offset = useAppStore((s) => s.hijriDaysOffset);
  const weekStartsOn = usePreferencesStore((s) => s.weekStartsOn);
  const timezone = useLocationStore((s) => s.locationDetails.timezone);
  const now = useTodayClock();

  const calculated = HijriNative.fromTimestamp(now.getTime() / 1000, timezone);
  const today = offset === HIJRI_NO_OFFSET ? calculated : HijriNative.addDays(calculated, offset);

  // Null follows today's month, so midnight at a month's end moves the view.
  const [chosen, setChosen] = useState<HijriYearMonth | null>(null);
  const [picked, setPicked] = useState<PickedDay | null>(null);
  // A clock outside the table opens on its nearest end.
  const home = clampHijriMonth(today);
  const shown = chosen ?? home;
  const isTodayMonth = sameMonth(today, shown);
  const pickedHere = picked !== null && sameMonth(picked, shown);
  const selectedDay = pickedHere ? picked.day : isTodayMonth ? today.day : null;

  const grid = buildMonthGrid({ ...shown, hijriDaysOffset: offset, weekStartsOn });
  const selected = selectedDay === null ? null : grid.cells[selectedDay - 1];
  const previous = stepMonth(shown.year, shown.month, -1);
  const next = stepMonth(shown.year, shown.month, 1);
  const note = MONTH_NOTES[shown.month];

  const present = new Set(
    [
      ...monthWeeklyObservances(shown.month),
      ...grid.cells.flatMap((cell) => cell.observances.filter((o) => !isWeekly(o))),
    ].map((o) => o.observanceClass)
  );
  const legend = MARK_ORDER.filter((observanceClass) => present.has(observanceClass));

  const firstDate = grid.cells[0].gregorian;
  const lastDate = grid.cells[grid.cells.length - 1].gregorian;
  const oneMonth = firstDate.getMonth() === lastDate.getMonth();
  const spanEnds = {
    from: text.dated(
      firstDate,
      firstDate.getFullYear() === lastDate.getFullYear() ? "MMMM" : "MMMM yyyy"
    ),
    to: text.dated(lastDate, "MMMM yyyy"),
  };
  const span = oneMonth
    ? text.dated(firstDate, "MMMM yyyy")
    : t("hijriCalendar.monthSpan", spanEnds);
  const spokenSpan = oneMonth ? span : t("a11y.hijriCalendar.monthSpan", spanEnds);

  const shift = useSharedValue(0);
  const fade = useSharedValue(1);
  const slide = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: [{ translateX: shift.get() }],
  }));

  // Set by a page turn; a month change from the clock or the offset stays still.
  const direction = useRef(0);
  const shownIndex = hijriMonthIndex(shown);
  // Before paint, so the new month never shows at rest before it slides.
  useLayoutEffect(() => {
    const sign = direction.current;
    direction.current = 0;
    if (sign === 0 || reduceMotion) return;
    // The new month enters from the side it lies on, mirrored under RTL.
    shift.set(sign * MONTH_SLIDE * (isRTL ? -1 : 1));
    shift.set(withTiming(0, { duration: MONTH_CHANGE_MS, easing: CURVE }));
    fade.set(0);
    fade.set(withTiming(1, { duration: MONTH_CHANGE_MS, easing: CURVE }));
  }, [shownIndex, reduceMotion, isRTL, shift, fade]);

  // Not awaited: the month is stored against the `home` of this render.
  const show = (destination: HijriYearMonth) => {
    void selectionHaptic();
    direction.current = Math.sign(hijriMonthIndex(destination) - shownIndex);
    setChosen(sameMonth(destination, home) ? null : destination);
    setPicked(null);
  };

  const PreviousIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;
  /** The line at either end of the table, with the year said by `year`. */
  const edgeLine = (year: (value: number) => string) =>
    !previous
      ? t("hijriCalendar.rangeStart", { year: year(HIJRI_YEAR_MIN) })
      : !next
        ? t("hijriCalendar.rangeEnd", { year: year(HIJRI_YEAR_MAX) })
        : null;
  const edge = edgeLine(text.yearAh);

  return (
    <ScreenSky>
      <SkyScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <SkyOccluder>
          <ScreenHeader
            title={t("hijriCalendar.title")}
            back={{ fallback: BACK_DESTINATION.TOOLS }}
            action={
              isTodayMonth || !sameMonth(today, home)
                ? undefined
                : {
                    icon: CalendarCheck,
                    label: t("a11y.hijriCalendar.today"),
                    onPress: () => show(home),
                  }
            }
          />
        </SkyOccluder>

        <ScreenContent paddingBottom="$section">
          <SkyOccluder>
            <HStack alignItems="center" gap="$tight">
              <Pressable
                onPress={() => previous && show(previous)}
                disabled={!previous}
                alignItems="center"
                justifyContent="center"
                borderRadius="$control"
                accessibilityLabel={t("a11y.hijriCalendar.previousMonth")}>
                <Icon as={PreviousIcon} size={NAV_ICON_SIZE} color="$accent" />
              </Pressable>
              <VStack flex={1} alignItems="center">
                <Text
                  size={isCursiveLocale(i18n.language) ? "heading" : "3xl"}
                  bold
                  typography="title"
                  color="$fg"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  accessibilityRole="header">
                  {text.monthName(shown.month)}
                </Text>
                <Text
                  size="md"
                  fontWeight="500"
                  color="$muted"
                  textAlign="center"
                  accessibilityLabel={t("a11y.join", {
                    first: text.spokenYearAh(shown.year),
                    second: spokenSpan,
                  })}>
                  {t("hijriCalendar.monthCaption", { year: text.yearAh(shown.year), span })}
                </Text>
              </VStack>
              <Pressable
                onPress={() => next && show(next)}
                disabled={!next}
                alignItems="center"
                justifyContent="center"
                borderRadius="$control"
                accessibilityLabel={t("a11y.hijriCalendar.nextMonth")}>
                <Icon as={NextIcon} size={NAV_ICON_SIZE} color="$accent" />
              </Pressable>
            </HStack>

            {edge && (
              <HStack
                marginTop="$inline"
                gap="$inline"
                paddingVertical="$2.5"
                paddingHorizontal="$stack"
                borderRadius="$control"
                backgroundColor="$surface"
                borderWidth={1}
                borderColor="$track">
                <Box marginTop={1}>
                  <Icon as={Info} size="md" color="$muted" />
                </Box>
                <Text
                  size="md"
                  color="$fg"
                  flex={1}
                  accessibilityLabel={edgeLine(text.spokenYearAh) ?? undefined}>
                  {edge}
                </Text>
              </HStack>
            )}

            {offset !== HIJRI_NO_OFFSET && (
              <HStack
                marginTop="$stack"
                alignItems="center"
                gap="$inline"
                paddingVertical="$tight"
                paddingStart="$stack"
                paddingEnd="$tight"
                borderRadius="$control"
                backgroundColor="$surface"
                borderWidth={1.5}
                borderColor="$accent">
                <Icon as={SlidersHorizontal} size="md" color="$accent" />
                <Text size="md" fontWeight="600" color="$fg" flex={1}>
                  {t("hijriCalendar.offsetLine", { value: hijriAdjustmentLabel(offset, t) })}
                </Text>
                <Pressable
                  onPress={() => router.push(BACK_DESTINATION.SETTINGS_HIJRI.href)}
                  paddingHorizontal="$stack"
                  alignItems="center"
                  justifyContent="center"
                  borderRadius="$control"
                  accessibilityLabel={t("a11y.hijriCalendar.changeOffset")}
                  accessibilityHint={t("a11y.opens", {
                    name: t(BACK_DESTINATION.SETTINGS_HIJRI.title),
                  })}>
                  <Text size="lg" fontWeight="600" color="$accent">
                    {t("hijriCalendar.change")}
                  </Text>
                </Pressable>
              </HStack>
            )}

            <Animated.View style={slide}>
              <HijriMonthGrid
                grid={grid}
                todayDay={isTodayMonth ? today.day : null}
                selectedDay={selectedDay}
                onSelect={(cell: MonthCell) => setPicked({ ...shown, day: cell.hijriDay })}
              />
            </Animated.View>

            <HStack flexWrap="wrap" rowGap="$tight" columnGap="$group" marginTop="$stack">
              {legend.map((observanceClass) => (
                <HStack key={observanceClass} alignItems="center" gap="$1.5" minHeight="$6">
                  <ObservanceGlyph observanceClass={observanceClass} size={LEGEND_GLYPH_SIZE} />
                  <Text size="helper" color="$fg">
                    {t(OBSERVANCE_MARK[observanceClass].labelKey)}
                  </Text>
                </HStack>
              ))}
            </HStack>

            <HStack gap="$inline" marginTop="$stack" alignItems="flex-start">
              <Box marginTop="$0.5">
                <Icon as={Info} size="sm" color="$muted" />
              </Box>
              <Text size="helper" color="$muted" flex={1}>
                {t("hijriCalendar.sighting")}
              </Text>
            </HStack>
          </SkyOccluder>

          {note && (
            <VStack
              marginTop="$group"
              paddingVertical="$stack"
              paddingHorizontal="$cardPad"
              borderRadius="$card"
              backgroundColor="$surface"
              borderWidth={1}
              borderColor="$track">
              <Text size="sm" fontWeight="600" color="$muted">
                {t("hijriCalendar.thisMonth")}
              </Text>
              <Text size="label" color="$fg">
                {t(note)}
              </Text>
            </VStack>
          )}

          {selected && (
            <VStack marginTop="$group">
              <DayDetail
                cell={selected}
                year={shown.year}
                month={shown.month}
                isToday={isTodayMonth && selected.hijriDay === today.day}
                announce={pickedHere}
              />
            </VStack>
          )}
        </ScreenContent>
      </SkyScrollView>
    </ScreenSky>
  );
};

export default HijriCalendarScreen;
