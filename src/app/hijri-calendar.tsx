import { useMemo, useState } from "react";
import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Info } from "lucide-react-native";

import { Background } from "@/components/ui/background";
import { Card } from "@/components/ui/card";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import TopBar from "@/components/TopBar";
import HijriMonthGrid from "@/components/hijri/HijriMonthGrid";
import DayObservanceSheet from "@/components/hijri/DayObservanceSheet";

import { useAppStore } from "@/stores/app";
import { useLocationStore } from "@/stores/location";
import usePreferencesStore from "@/stores/preferences";
import { HijriNative, getDateLocale } from "@/utils/date";
import { buildMonthGrid, stepMonth, type MonthCell } from "@/utils/hijriMonthGrid";
import { MONTH_NOTES } from "@/constants/Observances";
import { ObservanceClass } from "@/enums/observances";
import { formatNumberToLocale } from "@/utils/number";
import { useRTL } from "@/contexts/RTLContext";
import { useHaptic } from "@/hooks/useHaptic";

const LEGEND_LABEL: Record<string, string> = {
  [ObservanceClass.RECOMMENDED_FAST]: "hijriCalendar.legend.recommendedFast",
  [ObservanceClass.FASTING_FORBIDDEN]: "hijriCalendar.legend.fastingForbidden",
  [ObservanceClass.BLESSED_DAY]: "hijriCalendar.legend.blessedDay",
  [ObservanceClass.NIGHT_WORSHIP]: "hijriCalendar.legend.nightWorship",
};
const LEGEND_COLOR: Record<string, "$success" | "$error" | "$accentPrimary"> = {
  [ObservanceClass.RECOMMENDED_FAST]: "$success",
  [ObservanceClass.FASTING_FORBIDDEN]: "$error",
  [ObservanceClass.BLESSED_DAY]: "$accentPrimary",
  [ObservanceClass.NIGHT_WORSHIP]: "$accentPrimary",
};

const HijriCalendarScreen = () => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const selectionHaptic = useHaptic("selection");

  const hijriDaysOffset = useAppStore((s) => s.hijriDaysOffset);
  const locale = useAppStore((s) => s.locale);
  const { locationDetails } = useLocationStore();
  const weekStartsOn = usePreferencesStore((s) => s.weekStartsOn);

  const today = useMemo(() => {
    const raw = HijriNative.today(locationDetails.timezone);
    return hijriDaysOffset !== 0 ? HijriNative.addDays(raw, hijriDaysOffset) : raw;
  }, [locationDetails.timezone, hijriDaysOffset]);

  const [view, setView] = useState({ year: today.year, month: today.month });
  const [selected, setSelected] = useState<MonthCell | null>(null);

  const grid = useMemo(
    () => buildMonthGrid({ ...view, hijriDaysOffset, weekStartsOn }),
    [view, hijriDaysOffset, weekStartsOn]
  );

  const previous = stepMonth(view.year, view.month, -1);
  const next = stepMonth(view.year, view.month, 1);
  const isCurrentMonth = view.year === today.year && view.month === today.month;
  const note = MONTH_NOTES[view.month];

  // Only the classes on this month. A legend entry for a marker that is nowhere
  // on the grid is noise. The weekly columns are always marked, so their two
  // classes are always listed.
  const legend = useMemo(() => {
    const present = new Set<string>([
      ObservanceClass.RECOMMENDED_FAST,
      ObservanceClass.BLESSED_DAY,
    ]);
    for (const cell of grid.cells) {
      for (const observance of cell.observances) present.add(observance.observanceClass);
    }
    return [...present];
  }, [grid]);

  const goTo = async (target: { year: number; month: number } | null) => {
    if (!target) return;
    await selectionHaptic();
    setView(target);
  };

  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  // A Hijri month always spans two Gregorian ones, so the header names both ends.
  const gregorianRange = useMemo(() => {
    const dateLocale = getDateLocale(locale);
    const first = grid.cells[0].gregorian;
    const last = grid.cells[grid.cells.length - 1].gregorian;
    return `${format(first, "d MMM", { locale: dateLocale })} \u2013 ${format(last, "d MMM yyyy", { locale: dateLocale })}`;
  }, [grid, locale]);

  return (
    <Background>
      <TopBar title="hijriCalendar.title" backOnClick />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <VStack paddingHorizontal="$4" paddingTop="$2" gap="$3">
          <HStack justifyContent="space-between" alignItems="center">
            <VStack flexShrink={1}>
              <Text size="xl" fontWeight="700" color="$typography" accessibilityRole="header">
                {`${t(`hijriMonths.${view.month - 1}`)} ${formatNumberToLocale(String(view.year))}`}
              </Text>
              <Text size="sm" color="$typographySecondary">
                {formatNumberToLocale(gregorianRange)}
              </Text>
            </VStack>
            <HStack gap="$2" alignItems="center">
              <Pressable
                onPress={() => goTo(previous)}
                disabled={!previous}
                opacity={previous ? 1 : 0.4}
                minWidth={44}
                minHeight={44}
                alignItems="center"
                justifyContent="center"
                borderRadius="$4"
                backgroundColor="$backgroundMuted"
                accessibilityRole="button"
                accessibilityState={{ disabled: !previous }}
                accessibilityLabel={t("a11y.hijriCalendar.previousMonth")}>
                <Icon as={PrevIcon} size="md" color="$accentPrimary" />
              </Pressable>
              {!isCurrentMonth && (
                <Pressable
                  onPress={() => goTo({ year: today.year, month: today.month })}
                  minHeight={44}
                  paddingHorizontal="$3"
                  alignItems="center"
                  justifyContent="center"
                  borderRadius="$4"
                  backgroundColor="$backgroundMuted"
                  accessibilityRole="button"
                  accessibilityLabel={t("a11y.hijriCalendar.today")}>
                  <Text size="sm" fontWeight="600" color="$accentPrimary">
                    {t("hijriCalendar.today")}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => goTo(next)}
                disabled={!next}
                opacity={next ? 1 : 0.4}
                minWidth={44}
                minHeight={44}
                alignItems="center"
                justifyContent="center"
                borderRadius="$4"
                backgroundColor="$backgroundMuted"
                accessibilityRole="button"
                accessibilityState={{ disabled: !next }}
                accessibilityLabel={t("a11y.hijriCalendar.nextMonth")}>
                <Icon as={NextIcon} size="md" color="$accentPrimary" />
              </Pressable>
            </HStack>
          </HStack>

          {note && (
            <HStack
              gap="$2"
              alignItems="flex-start"
              backgroundColor="$backgroundWarning"
              borderRadius="$4"
              padding="$3">
              <Icon as={Info} size="xs" color="$warning" />
              <Text size="xs" color="$warning" flex={1}>
                {t(note)}
              </Text>
            </HStack>
          )}

          <Card padding="$3">
            <HijriMonthGrid
              grid={grid}
              todayHijriDay={isCurrentMonth ? today.day : null}
              selectedDay={selected?.hijriDay ?? null}
              onSelectDay={setSelected}
            />
            <HStack flexWrap="wrap" gap="$3" paddingTop="$3">
              {legend.map((observanceClass) => (
                <HStack key={observanceClass} gap="$1.5" alignItems="center">
                  <Box
                    width={6}
                    height={6}
                    borderRadius="$10"
                    backgroundColor={LEGEND_COLOR[observanceClass]}
                  />
                  <Text size="xs" color="$typographySecondary">
                    {t(LEGEND_LABEL[observanceClass])}
                  </Text>
                </HStack>
              ))}
            </HStack>
          </Card>
        </VStack>
      </ScrollView>

      <DayObservanceSheet
        cell={selected}
        hijriMonth={view.month}
        hijriYear={view.year}
        onClose={() => setSelected(null)}
      />
    </Background>
  );
};

export default HijriCalendarScreen;
