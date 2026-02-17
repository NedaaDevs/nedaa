import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { parseISO, differenceInSeconds, formatDistance } from "date-fns";

// Utils
import { formatNumberToLocale } from "@/utils/number";
import { getDateLocale, timeZonedNow } from "@/utils/date";

// Stores
import { useDisplayStore } from "@/stores/display";
import { useAppStore } from "@/stores/app";

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
  previousPrayer: Prayer | null,
  timezone: string
): TimerResult => {
  const [now, setNow] = useState(() => timeZonedNow(timezone));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { locale } = useAppStore();
  const { countdownEnabled, countdownMinutes, iqamaCountUpEnabled, iqamaCountUpMinutes } =
    useDisplayStore();

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
      setNow(timeZonedNow(timezone));
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerMode, timezone]);

  const formatMMSS = useCallback((totalSeconds: number): string => {
    const absSeconds = Math.abs(Math.floor(totalSeconds));
    const mins = Math.floor(absSeconds / 60);
    const secs = absSeconds % 60;
    const raw = `${mins}:${secs.toString().padStart(2, "0")}`;
    return formatNumberToLocale(raw);
  }, []);

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
      const timeRemaining = formatDistance(nextTime, now, {
        addSuffix: false,
        locale: getDateLocale(locale),
      });
      return formatNumberToLocale(timeRemaining);
    }

    return "";
  }, [timerMode, now, nextPrayer, previousPrayer, locale, formatMMSS]);

  const iqamaPrayerName = useMemo((): string | null => {
    if (timerMode === "iqama" && previousPrayer) {
      return previousPrayer.name;
    }
    return null;
  }, [timerMode, previousPrayer]);

  return { mode: timerMode, display, iqamaPrayerName };
};
