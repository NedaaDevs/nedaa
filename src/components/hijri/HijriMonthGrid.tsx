import { useTranslation } from "react-i18next";

import { ObservanceGlyph } from "@/components/hijri/ObservanceGlyph";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { useElevationShadow } from "@/components/ui/material/edge";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  DAY_CELL_HEIGHT,
  DAYS_PER_WEEK,
  HIJRI_CALENDAR_TEST_ID,
  TODAY_BAR,
  WEEKDAYS,
} from "@/constants/HijriCalendar";
import { ELEVATION_LEVEL } from "@/constants/Elevation";
import { ObservanceClass } from "@/enums/observances";
import { useHijriCalendarText } from "@/hooks/useHijriCalendarText";
import type { MonthCell, MonthGrid } from "@/utils/hijriMonthGrid";
import { isWeekly, monthWeeklyObservances, weekdayObservances } from "@/utils/observances";

const WEEK_MARK_SIZE = 12;
const NIGHT_MARK_SIZE = 13;

type Props = {
  grid: MonthGrid;
  todayDay: number | null;
  selectedDay: number | null;
  onSelect: (cell: MonthCell) => void;
};

type CellProps = {
  cell: MonthCell;
  label: string;
  numeral: string;
  dateLine: string;
  /** The selected cell's shadow, shared by every cell of the grid. */
  lift: string | undefined;
  isToday: boolean;
  isSelected: boolean;
  onSelect: (cell: MonthCell) => void;
};

const DayCell = ({
  cell,
  label,
  numeral,
  dateLine,
  lift,
  isToday,
  isSelected,
  onSelect,
}: CellProps) => {
  const has = (observanceClass: ObservanceClass) =>
    cell.observances.some((o) => !isWeekly(o) && o.observanceClass === observanceClass);
  const forbidden = has(ObservanceClass.FASTING_FORBIDDEN);
  const recommended = has(ObservanceClass.RECOMMENDED_FAST);
  const first = cell.gregorian.getDate() === 1;

  return (
    <Pressable
      flex={1}
      height={DAY_CELL_HEIGHT}
      alignItems="center"
      paddingTop="$tight"
      borderRadius="$control"
      backgroundColor={isSelected ? "$raised" : "transparent"}
      style={isSelected ? { boxShadow: lift } : undefined}
      onPress={() => onSelect(cell)}
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={label}>
      {isSelected && (
        <Box
          position="absolute"
          inset={0}
          borderRadius="$control"
          borderWidth={2}
          borderColor="$fg"
          pointerEvents="none"
        />
      )}
      {has(ObservanceClass.NIGHT_WORSHIP) && (
        <Box position="absolute" top="$0.5" end="$0.5">
          <ObservanceGlyph observanceClass={ObservanceClass.NIGHT_WORSHIP} size={NIGHT_MARK_SIZE} />
        </Box>
      )}
      <Box
        width="$9"
        height="$9"
        alignItems="center"
        justifyContent="center"
        borderRadius={forbidden ? "$chip" : "$pill"}
        backgroundColor={forbidden ? "$warn" : "transparent"}
        borderWidth={recommended ? 2 : 0}
        borderColor="$accent">
        <Text
          size="xl"
          fontWeight={isToday ? "700" : "600"}
          color={forbidden ? "$bg" : "$fg"}
          numeric>
          {numeral}
        </Text>
      </Box>
      <Text
        size="xs"
        fontWeight={first ? "600" : "500"}
        color={first ? "$fg" : "$muted"}
        numberOfLines={1}>
        {dateLine}
      </Text>
      {isToday && (
        <Box
          position="absolute"
          bottom={TODAY_BAR.INSET}
          width={TODAY_BAR.WIDTH}
          height={TODAY_BAR.HEIGHT}
          borderRadius="$pill"
          backgroundColor="$fg"
        />
      )}
    </Pressable>
  );
};

/** The weekday row with its weekly marks, then the month's days. */
export const HijriMonthGrid = ({ grid, todayDay, selectedDay, onSelect }: Props) => {
  const { t } = useTranslation();
  const text = useHijriCalendarText();
  const lift = useElevationShadow(ELEVATION_LEVEL.E1);
  const weekdayNames = t("weekdaysShort", { returnObjects: true }) as string[];

  // Columns run from the first weekday in logical order; React Native mirrors
  // the row under RTL, so reversing them here would draw the week backwards.
  const columns = WEEKDAYS.map(
    (i) => (grid.cells[0].weekday - grid.leadingPad + i + DAYS_PER_WEEK) % DAYS_PER_WEEK
  );
  const weekly = monthWeeklyObservances(grid.month);
  const rows = Math.ceil((grid.leadingPad + grid.cells.length) / DAYS_PER_WEEK);
  const cellAt = (row: number, column: number) =>
    grid.cells[row * DAYS_PER_WEEK + column - grid.leadingPad] ?? null;

  return (
    <VStack>
      <HStack
        marginTop="$stack"
        paddingBottom="$1.5"
        borderBottomWidth={1}
        borderColor="$track"
        accessible={weekly.length > 0}
        accessibilityLabel={text.sentences(weekly.map(text.marked))}>
        {columns.map((weekday) => {
          const mark = weekdayObservances(weekday, grid.month)[0];
          return (
            <VStack key={weekday} flex={1} alignItems="center" gap="$0.5" minHeight="$9">
              <Text
                testID={HIJRI_CALENDAR_TEST_ID.WEEKDAY}
                size="sm"
                fontWeight="600"
                color={mark ? "$fg" : "$muted"}
                numberOfLines={1}
                adjustsFontSizeToFit>
                {weekdayNames[weekday]}
              </Text>
              {mark && (
                <ObservanceGlyph observanceClass={mark.observanceClass} size={WEEK_MARK_SIZE} />
              )}
            </VStack>
          );
        })}
      </HStack>

      <VStack marginTop="$tight">
        {Array.from({ length: rows }, (_, row) => (
          <HStack key={row}>
            {columns.map((weekday, column) => {
              const cell = cellAt(row, column);
              if (!cell) return <Box key={weekday} flex={1} height={DAY_CELL_HEIGHT} />;
              const isToday = cell.hijriDay === todayDay;
              // A Hijri month spans two Gregorian ones, so the 1st names its month.
              const dateLine =
                cell.gregorian.getDate() === 1
                  ? text.dated(cell.gregorian, "d MMM")
                  : text.digits(cell.gregorian.getDate());
              return (
                <DayCell
                  key={weekday}
                  cell={cell}
                  label={text.cellLabel(cell, grid.month, isToday)}
                  numeral={text.digits(cell.hijriDay)}
                  dateLine={dateLine}
                  lift={lift}
                  isToday={isToday}
                  isSelected={cell.hijriDay === selectedDay}
                  onSelect={onSelect}
                />
              );
            })}
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
};
