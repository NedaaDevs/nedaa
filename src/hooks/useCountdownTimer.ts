import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { parseISO, differenceInSeconds } from "date-fns";

// Utils
import { formatNumberToLocale } from "@/utils/number";
import { formatHoursMinutes } from "@/utils/countdown";

// Stores
import { usePreferencesStore } from "@/stores/preferences";

// Types
import type { Prayer } from "@/types/prayerTimes";

type TimerMode = "general" | "countdown" | "iqama";

type TimerResult = {
  mode: TimerMode;
  display: string;
  iqamaPrayerName: string | null;
};

export const useCountdownTimer = (
  nextPrayer: Prayer | null,
  previousPrayer: Prayer | null
): TimerResult => {
  // A real instant, not timeZonedNow(): every comparison below is against a
  // stored time that already carries the location's UTC offset, so the device's
  // own timezone must not enter into it.
  const [now, setNow] = useState(() => new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { countdownEnabled, countdownMinutes, iqamaCountUpEnabled, iqamaCountUpMinutes } =
    usePreferencesStore();

  const timerMode = useMemo((): TimerMode => {
    if (iqamaCountUpEnabled && previousPrayer) {
      const prevTime = parseISO(previousPrayer.time);
      const secsSince = differenceInSeconds(now, prevTime);
      if (secsSince >= 0 && secsSince <= iqamaCountUpMinutes * 60) {
        return "iqama";
      }
    }

    if (countdownEnabled && nextPrayer) {
      const nextTime = parseISO(nextPrayer.time);
      const secsUntil = differenceInSeconds(nextTime, now);
      if (secsUntil > 0 && secsUntil <= countdownMinutes * 60) {
        return "countdown";
      }
    }

    return "general";
  }, [
    now,
    nextPrayer,
    previousPrayer,
    countdownEnabled,
    countdownMinutes,
    iqamaCountUpEnabled,
    iqamaCountUpMinutes,
  ]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const intervalMs = timerMode === "general" ? 30_000 : 1_000;

    intervalRef.current = setInterval(() => {
      setNow(new Date());
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerMode]);

  const formatMMSS = useCallback((totalSeconds: number): string => {
    const absSeconds = Math.abs(Math.floor(totalSeconds));
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    const raw = `${mins}:${secs.toString().padStart(2, "0")}`;
    return formatNumberToLocale(raw);
  }, []);

  const formatHMM = useCallback(
    (totalSeconds: number): string => formatNumberToLocale(formatHoursMinutes(totalSeconds)),
    []
  );

  const display = useMemo((): string => {
    if (timerMode === "countdown" && nextPrayer) {
      const nextTime = parseISO(nextPrayer.time);
      const secsUntil = differenceInSeconds(nextTime, now);
      return formatMMSS(secsUntil);
    }

    if (timerMode === "iqama" && previousPrayer) {
      const prevTime = parseISO(previousPrayer.time);
      const secsSince = differenceInSeconds(now, prevTime);
      return formatMMSS(secsSince);
    }

    if (nextPrayer) {
      const nextTime = parseISO(nextPrayer.time);
      return formatHMM(differenceInSeconds(nextTime, now));
    }

    return "";
  }, [timerMode, now, nextPrayer, previousPrayer, formatMMSS, formatHMM]);

  const iqamaPrayerName = useMemo((): string | null => {
    if (timerMode === "iqama" && previousPrayer) {
      return previousPrayer.name;
    }
    return null;
  }, [timerMode, previousPrayer]);

  return { mode: timerMode, display, iqamaPrayerName };
};
