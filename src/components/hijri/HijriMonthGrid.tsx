import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";

import { ObservanceClass } from "@/enums/observances";
import type { MonthCell, MonthGrid } from "@/utils/hijriMonthGrid";
import { formatNumberToLocale } from "@/utils/number";
import { getDateLocale } from "@/utils/date";
import { useAppStore } from "@/stores/app";

// One dot per cell. A day never carries two marks: prohibition already
// suppressed any recommendation, and night worship never coincides with either.
// Values stay literal tokens: a widened string is not assignable to Tamagui's
// backgroundColor type.
const DOT_COLOR: Record<string, "$success" | "$error" | "$accentPrimary"> = {
  [ObservanceClass.RECOMMENDED_FAST]: "$success",
  [ObservanceClass.FASTING_FORBIDDEN]: "$error",
  [ObservanceClass.NIGHT_WORSHIP]: "$accentPrimary",
};

// Weekly observances belong to a whole column, so they mark the header rather
// than every cell beneath it.
const WEEKLY_MARK: Record<number, "fast" | "blessed"> = { 1: "fast", 4: "fast", 5: "blessed" };

type HijriMonthGridProps = {
  grid: MonthGrid;
  todayHijriDay: number | null;
  selectedDay: number | null;
  onSelectDay: (cell: MonthCell) => void;
};

const HijriMonthGrid = ({ grid, todayHijriDay, selectedDay, onSelectDay }: HijriMonthGridProps) => {
  const { t } = useTranslation();
  const locale = useAppStore((s) => s.locale);

  const weekdayNames = t("weekdaysShort", { returnObjects: true }) as string[];

  // Column order starts at the user's first weekday, then flips for RTL.
  // Columns run from the user's first weekday in logical order. React Native
  // flips the row itself under RTL, so reversing here would cancel that out and
  // render the week backwards.
  const columns = useMemo(() => {
    const start = grid.cells[0].weekday - grid.leadingPad;
    return Array.from({ length: 7 }, (_, i) => (((start + i) % 7) + 7) % 7);
  }, [grid]);

  const cellFor = (columnIndex: number, row: number): MonthCell | null => {
    const position = row * 7 + columnIndex;
    const dayIndex = position - grid.leadingPad;
    return dayIndex >= 0 && dayIndex < grid.cells.length ? grid.cells[dayIndex] : null;
  };

  const rows = Math.ceil((grid.leadingPad + grid.cells.length) / 7);

  return (
    <VStack>
      <Box flexDirection="row">
        {columns.map((weekday) => (
          <VStack key={weekday} flex={1} alignItems="center" paddingBottom="$2" gap="$1">
            <Text size="xs" fontWeight="600" color="$typographySecondary">
              {weekdayNames[weekday]}
            </Text>
            <Box
              width={6}
              height={6}
              borderRadius={WEEKLY_MARK[weekday] === "blessed" ? "$1" : "$10"}
              transform={WEEKLY_MARK[weekday] === "blessed" ? [{ rotate: "45deg" }] : undefined}
              backgroundColor={
                WEEKLY_MARK[weekday] === "fast"
                  ? "$success"
                  : WEEKLY_MARK[weekday] === "blessed"
                    ? "$accentPrimary"
                    : "transparent"
              }
            />
          </VStack>
        ))}
      </Box>

      {Array.from({ length: rows }, (_, row) => (
        <Box key={row} flexDirection="row">
          {columns.map((_weekday, columnIndex) => {
            const cell = cellFor(columnIndex, row);
            if (!cell) return <Box key={columnIndex} flex={1} height={54} />;

            const isToday = cell.hijriDay === todayHijriDay;
            const isSelected = cell.hijriDay === selectedDay;
            const marker = cell.observances.find((o) => DOT_COLOR[o.observanceClass]);
            const names = cell.observances.map((o) => t(o.nameKey)).join(", ");

            return (
              <Pressable
                key={columnIndex}
                flex={1}
                minHeight={54}
                alignItems="center"
                justifyContent="center"
                borderRadius="$4"
                backgroundColor={isSelected ? "$accentPrimary" : "transparent"}
                borderWidth={isToday && !isSelected ? 2 : 0}
                borderColor="$accentPrimary"
                onPress={() => onSelectDay(cell)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={[
                  formatNumberToLocale(String(cell.hijriDay)),
                  t(`hijriMonths.${grid.month - 1}`),
                  formatNumberToLocale(String(grid.year)),
                  format(cell.gregorian, "EEEE d MMMM yyyy", { locale: getDateLocale(locale) }),
                  isToday ? t("hijriCalendar.today") : "",
                  names,
                ]
                  .filter(Boolean)
                  .join(", ")}>
                <Text
                  size="md"
                  fontWeight={isToday ? "700" : "600"}
                  color={
                    isSelected ? "$typographyContrast" : isToday ? "$accentPrimary" : "$typography"
                  }>
                  {formatNumberToLocale(String(cell.hijriDay))}
                </Text>
                <Text size="xs" color={isSelected ? "$typographyContrast" : "$typographySecondary"}>
                  {/* A Hijri month spans two Gregorian ones, so the 1st names its month. */}
                  {formatNumberToLocale(
                    format(cell.gregorian, cell.gregorian.getDate() === 1 ? "MMM d" : "d", {
                      locale: getDateLocale(locale),
                    })
                  )}
                </Text>
                <Box
                  width={5}
                  height={5}
                  marginTop="$0.5"
                  borderRadius="$10"
                  backgroundColor={marker ? DOT_COLOR[marker.observanceClass] : "transparent"}
                />
              </Pressable>
            );
          })}
        </Box>
      ))}
    </VStack>
  );
};

export default HijriMonthGrid;
