import { useEffect, useState, type ReactNode } from "react";
import { parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { PRAYER_ID } from "@/constants/Prayer";
import { SimulatedClockContext } from "@/hooks/useTodayClock";
import { useDebugModeStore } from "@/stores/debugMode";
import { usePrayerTimesStore } from "@/stores/prayerTimes";

/** A debug run through the day: 15 minutes every quarter second. */
export const DAY_SIMULATION = {
  label: "Simulate a day",
  tickMs: 250,
  stepMs: 15 * 60_000,
  /** How far before Fajr the run starts and past Isha it ends. */
  marginMs: 30 * 60_000,
} as const;

/** Plays Today's clock through a whole day, behind debug mode. */
export const DaySimulator = ({ children }: { children: ReactNode }) => {
  const debug = useDebugModeStore((state) => state.isEnabled);
  const today = usePrayerTimesStore((state) => state.todayTimings);
  const [simulated, setSimulated] = useState<Date | null>(null);

  useEffect(() => {
    if (!simulated || !today) return;
    const end = parseISO(today.timings[PRAYER_ID.ISHA]).getTime() + DAY_SIMULATION.marginMs;
    const timer = setTimeout(() => {
      const next = simulated.getTime() + DAY_SIMULATION.stepMs;
      setSimulated(next > end ? null : new Date(next));
    }, DAY_SIMULATION.tickMs);
    return () => clearTimeout(timer);
  }, [simulated, today]);

  const start = () => {
    if (!today) return;
    const fajr = parseISO(today.timings[PRAYER_ID.FAJR]).getTime();
    setSimulated(new Date(fajr - DAY_SIMULATION.marginMs));
  };

  return (
    <SimulatedClockContext value={simulated}>
      {children}
      {debug && (
        <Button
          onPress={start}
          disabled={simulated !== null}
          accessible
          accessibilityRole="button"
          accessibilityLabel={DAY_SIMULATION.label}>
          <Button.Text>{DAY_SIMULATION.label}</Button.Text>
        </Button>
      )}
    </SimulatedClockContext>
  );
};
