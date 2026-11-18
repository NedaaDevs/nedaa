import { QADA_ENTRY_STATUS, QADA_ENTRY_TYPE } from "@/constants/Qada";
import type { QadaHistory } from "@/services/qada-db";
import type { HijriDate } from "@/utils/date";

/** The batch a recorded day comes off: the open one added first. */
export const oldestOpenBatch = (entries: readonly QadaHistory[]): QadaHistory | undefined =>
  entries
    .filter(
      ({ type, status }) => type === QADA_ENTRY_TYPE.ADDED && status === QADA_ENTRY_STATUS.PENDING
    )
    .reduce<QadaHistory | undefined>((oldest, entry) => {
      if (!oldest) return entry;
      if (entry.created_at !== oldest.created_at) {
        return entry.created_at < oldest.created_at ? entry : oldest;
      }
      return entry.id < oldest.id ? entry : oldest;
    }, undefined);

/** How a Hijri date reads beside today: today, or day and month, with the year only when it differs. */
export type DayLabel =
  { today: true } | { today: false; day: number; month: number; year?: number };

export const dayLabelOf = (date: HijriDate, today: HijriDate): DayLabel => {
  const sameYear = date.year === today.year;
  if (sameYear && date.month === today.month && date.day === today.day) return { today: true };
  return sameYear
    ? { today: false, day: date.day, month: date.month }
    : { today: false, day: date.day, month: date.month, year: date.year };
};
