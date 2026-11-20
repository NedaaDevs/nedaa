import { createContext, use } from "react";
import { useDrawnMode } from "@/contexts/DrawnModeContext";
import { usePhase } from "@/contexts/PhaseContext";
import { useRTL } from "@/contexts/RTLContext";
import { useAppScheme } from "@/contexts/SchemeContext";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useStoredDays } from "@/hooks/useStoredDays";
import { useClockOverride } from "@/hooks/useTodayClock";
import { useAppStore } from "@/stores/app";
import { celestialPositionAt } from "@/utils/celestial";
import { hijriDayAt } from "@/utils/moonPhase";
import { phaseAt } from "@/utils/phase";
import { skySceneFor } from "@/utils/sky";

/**
 * What the sky paints now: the drawn mode at this phase and hour. `mode` is the
 * user's choice, which a day run does not move.
 */
export const useLiveSky = () => {
  const { isRTL } = useRTL();
  const reduced = useReducedMotion();
  const clock = useMinuteClock();
  const override = useClockOverride();
  const now = override ?? clock;
  const days = useStoredDays();
  // A pinned moment paints its own phase; the live one comes from the root.
  const livePhase = usePhase();
  const phase = (override && phaseAt(override, days)) || livePhase;
  const mode = useAppStore((state) => state.mode);
  const drawnMode = useDrawnMode();
  const scheme = useAppScheme();
  const hijriOffset = useAppStore((state) => state.hijriDaysOffset);

  return {
    mode,
    scheme,
    phase,
    scene: skySceneFor(drawnMode, scheme, phase),
    celestial: celestialPositionAt(now, days),
    hijriDay: days.today ? hijriDayAt(now, days.today.timezone, hijriOffset) : undefined,
    isRTL,
    reduced,
  };
};

/** The sky a SkyBackground paints, for the screen drawn over it. */
export const LiveSkyContext = createContext<ReturnType<typeof useLiveSky> | null>(null);

/** The sky the enclosing SkyBackground paints, read from its one clock. */
export const usePageSky = () => {
  const sky = use(LiveSkyContext);
  if (!sky) throw new Error("usePageSky needs a SkyBackground above it");
  return sky;
};
