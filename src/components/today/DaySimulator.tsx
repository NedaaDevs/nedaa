import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { parseISO } from "date-fns";

import { BrightnessTheme } from "@/components/ui/brightness-theme";
import { Button } from "@/components/ui/button";
import { PRAYER_ID } from "@/constants/Prayer";
import { PhaseContext } from "@/contexts/PhaseContext";
import { useAppScheme } from "@/contexts/SchemeContext";
import { SimulatedClockContext } from "@/hooks/useTodayClock";
import { useAppStore } from "@/stores/app";
import { useDebugModeStore } from "@/stores/debugMode";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { isDarkMode } from "@/utils/appearance";
import { ONE_DAY_MS, phaseAt } from "@/utils/phase";

/** A debug run through the day: 5 minutes every 50ms, about 15s in all. */
export const DAY_SIMULATION = {
  label: "Simulate a day",
  tickMs: 50,
  stepMs: 5 * 60_000,
  /** How far before Fajr the run starts. */
  marginMs: 30 * 60_000,
} as const;

/** Starts a run; null while one plays or the day's times are unknown. */
const StartContext = createContext<(() => void) | null>(null);

/** Plays Today's clock through a whole day for everything inside it. */
export const DaySimulator = ({ children }: { children: ReactNode }) => {
  const yesterday = usePrayerTimesStore((state) => state.yesterdayTimings);
  const today = usePrayerTimesStore((state) => state.todayTimings);
  const tomorrow = usePrayerTimesStore((state) => state.tomorrowTimings);
  const mode = useAppStore((state) => state.mode);
  const scheme = useAppScheme();
  const [simulated, setSimulated] = useState<Date | null>(null);

  useEffect(() => {
    if (!simulated || !today) return;
    // The run ends at the next Fajr, where the moon's arc ends.
    const end = tomorrow
      ? parseISO(tomorrow.timings[PRAYER_ID.FAJR]).getTime()
      : parseISO(today.timings[PRAYER_ID.FAJR]).getTime() + ONE_DAY_MS;
    const timer = setTimeout(() => {
      const next = simulated.getTime() + DAY_SIMULATION.stepMs;
      setSimulated(next > end ? null : new Date(next));
    }, DAY_SIMULATION.tickMs);
    return () => clearTimeout(timer);
  }, [simulated, today, tomorrow]);

  const start =
    today && !simulated
      ? () => {
          const fajr = parseISO(today.timings[PRAYER_ID.FAJR]).getTime();
          setSimulated(new Date(fajr - DAY_SIMULATION.marginMs));
        }
      : null;

  const content = <StartContext value={start}>{children}</StartContext>;
  const phase = simulated && phaseAt(simulated, { yesterday, today, tomorrow });

  return (
    <SimulatedClockContext value={simulated}>
      {phase ? (
        // Adaptive draws by the phase, so a run brings its own phase and theme.
        <PhaseContext value={phase}>
          <BrightnessTheme dark={isDarkMode(mode, scheme, phase)}>{content}</BrightnessTheme>
        </PhaseContext>
      ) : (
        content
      )}
    </SimulatedClockContext>
  );
};

/** The button that starts a run, shown only in debug mode. */
export const DaySimulatorButton = () => {
  const debug = useDebugModeStore((state) => state.isEnabled);
  const start = use(StartContext);
  if (!debug) return null;

  return (
    <Button
      onPress={() => start?.()}
      disabled={!start}
      accessibilityRole="button"
      accessibilityLabel={DAY_SIMULATION.label}>
      <Button.Text>{DAY_SIMULATION.label}</Button.Text>
    </Button>
  );
};
