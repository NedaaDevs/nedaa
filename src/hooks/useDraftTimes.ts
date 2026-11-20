import { addMinutes, parseISO } from "date-fns";

import { recalculates, tuneShift } from "@/components/calculation/calculationOptions";
import { isPrayerId } from "@/constants/Prayer";
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import type { DayPrayerTimes } from "@/types/prayerTimes";
import type { AladhanPrayerTimeName, AladhanSettings } from "@/types/providers/aladhan";

const ALADHAN = PRAYER_TIME_PROVIDERS.ALADHAN;

const storedTime = (day: DayPrayerTimes, timing: AladhanPrayerTimeName) =>
  isPrayerId(timing) ? day.timings[timing] : day.otherTimings[timing];

/** What the stored times came from; null when a failed apply hides it. */
export const useTimesSource = (): AladhanSettings | null => {
  const applied = useProviderSettingsStore((state) => state.allSettings[ALADHAN.id]);
  const unsure = useProviderSettingsStore((state) => state.pendingReapply);
  const reported = useProviderSettingsStore((state) => state.inEffect);

  if (!unsure) return reported ?? applied ?? {};
  // A choice left to the provider cannot be matched against its old report.
  const matches =
    reported && applied?.method != null && !recalculates(applied, { ...applied, ...reported });
  return matches ? reported : null;
};

/** Today's stored times, moved as the draft's adjustment would move them. */
export const useDraftTimes = (draft: AladhanSettings) => {
  const today = usePrayerTimesStore((state) => state.todayTimings);
  const applied = useProviderSettingsStore((state) => state.allSettings[ALADHAN.id]);
  const unsure = useProviderSettingsStore((state) => state.pendingReapply);
  const source = useTimesSource();

  const shift = (timing: AladhanPrayerTimeName) =>
    source ? tuneShift(draft.tune, source.tune, timing) : 0;
  // Only an adjustment moves a stored time; any other change needs the server.
  const known = today !== null && source !== null && !recalculates(draft, applied);

  return {
    today,
    source,
    shift,
    known,
    /** Whether the times on screen wait for an Apply to become the draft's. */
    pending: unsure || recalculates(draft, applied),
    /** The draft's time for a timing; null while unknown before Apply. */
    timeOf: (timing: AladhanPrayerTimeName) =>
      today && known ? addMinutes(parseISO(storedTime(today, timing)), shift(timing)) : null,
    /** A timing as calculated, before any adjustment; null when not known. */
    calculatedOf: (timing: AladhanPrayerTimeName) =>
      today && known
        ? addMinutes(parseISO(storedTime(today, timing)), -(source?.tune?.[timing] ?? 0))
        : null,
  };
};
