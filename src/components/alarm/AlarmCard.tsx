import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { parseISO, format, isToday } from "date-fns";

// Components
import { Box } from "@/components/ui/box";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { Pressable } from "@/components/ui/pressable";
import { Button, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

// Icons
import { Sun, CalendarDays, ChevronRight, ChevronLeft, Play, X } from "lucide-react-native";

// Services
import { scheduleAlarm, alarmKit } from "@/services/alarm";

// Contexts
import { useRTL } from "@/contexts/RTLContext";

// Types
import type { AlarmSettings, AlarmType } from "@/types/alarm";

// Stores
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import locationStore from "@/stores/location";

// Utils
import { timeZonedNow } from "@/utils/date";
import { PlatformType } from "@/enums/app";

type AlarmCardProps = {
  type: AlarmType;
  settings: AlarmSettings;
  onToggle: (enabled: boolean) => void;
  onPress: () => void;
  onEditPress: () => void;
};

// Preview countdown duration in seconds (consistent across platforms)
const PREVIEW_COUNTDOWN_SECONDS = 5;

const AlarmCard = ({ type, settings, onToggle, onPress, onEditPress }: AlarmCardProps) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  // Preview state
  const [previewState, setPreviewState] = useState<"idle" | "countdown" | "scheduled">("idle");
  const [countdown, setCountdown] = useState(PREVIEW_COUNTDOWN_SECONDS);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewAlarmIdRef = useRef<string | null>(null);

  const todayTimings = usePrayerTimesStore((state) => state.todayTimings);
  const tomorrowTimings = usePrayerTimesStore((state) => state.tomorrowTimings);
  const timezone = locationStore.getState().locationDetails.timezone;

  const isFajr = type === "fajr";
  const CardIcon = isFajr ? Sun : CalendarDays;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      // Cancel any scheduled preview alarm
      if (previewAlarmIdRef.current) {
        import("@/services/alarm").then(({ cancelAlarm }) => {
          if (previewAlarmIdRef.current) {
            cancelAlarm(previewAlarmIdRef.current);
          }
        });
      }
    };
  }, []);

  // Cancel preview - cancels the scheduled alarm
  const cancelPreview = useCallback(async () => {
    // Clear countdown interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // Cancel scheduled alarm if exists
    if (previewAlarmIdRef.current) {
      try {
        const { cancelAlarm } = await import("@/services/alarm");
        await cancelAlarm(previewAlarmIdRef.current);
      } catch (error) {
        console.error("[AlarmCard] Cancel preview failed:", error);
      }
      previewAlarmIdRef.current = null;
    }

    // Reset state
    setPreviewState("idle");
    setCountdown(PREVIEW_COUNTDOWN_SECONDS);
  }, []);

  // Schedule the actual alarm
  const schedulePreviewAlarm = useCallback(async () => {
    try {
      const previewId = `preview-${type}-${Date.now()}`;
      previewAlarmIdRef.current = previewId;

      if (Platform.OS === "android") {
        const previewTime = new Date(Date.now() + 1000); // 1 second from now (countdown already passed)
        await scheduleAlarm({
          id: previewId,
          type,
          scheduledTime: previewTime,
          title: isFajr ? t("alarm.overlay.fajrPrayer") : t("alarm.overlay.jummahPrayer"),
          body: isFajr ? t("alarm.prayerBetterThanSleep") : t("alarm.jummahReminder"),
          subtitle: isFajr ? t("alarm.prayerBetterThanSleep") : undefined,
          settings,
        });
      } else if (Platform.OS === "ios") {
        const previewTime = new Date(Date.now() + 1000);
        await alarmKit.scheduleAlarm({
          title: isFajr ? t("alarm.overlay.fajrPrayer") : t("alarm.overlay.jummahPrayer"),
          timestamp: previewTime.getTime(),
          snoozeMinutes: settings.snoozeEnabled ? settings.snoozeDurationMinutes : undefined,
          tintColor: isFajr ? "#4CAF50" : "#2196F3",
          stopButtonText: isFajr ? t("alarm.prayerBetterThanSleep") : undefined,
        });
      }

      setPreviewState("scheduled");

      // Reset to idle after alarm should have fired
      setTimeout(() => {
        setPreviewState("idle");
        setCountdown(PREVIEW_COUNTDOWN_SECONDS);
        previewAlarmIdRef.current = null;
      }, 3000);
    } catch (error) {
      console.error("[AlarmCard] Preview scheduling failed:", error);
      setPreviewState("idle");
      setCountdown(PREVIEW_COUNTDOWN_SECONDS);
    }
  }, [type, isFajr, settings, t]);

  // Start preview with countdown
  const handlePreview = useCallback(() => {
    setPreviewState("countdown");
    setCountdown(PREVIEW_COUNTDOWN_SECONDS);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Countdown finished - schedule alarm
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          schedulePreviewAlarm();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [schedulePreviewAlarm]);

  // Calculate next alarm time
  const getNextAlarmTime = (): { time: string; occurrence: string } | null => {
    if (!settings.hasCompletedSetup) return null;

    const now = timeZonedNow(timezone);

    if (settings.timeMode === "fixed") {
      // Fixed time mode
      const hour = settings.fixedHour ?? 5;
      const minute = settings.fixedMinute ?? 0;
      const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

      // Calculate next occurrence
      const todayAlarm = new Date(now);
      todayAlarm.setHours(hour, minute, 0, 0);

      if (todayAlarm > now) {
        return {
          time: timeString,
          occurrence: t("alarm.card.today", "Today"),
        };
      } else {
        return {
          time: timeString,
          occurrence: t("alarm.card.tomorrow", "Tomorrow"),
        };
      }
    } else {
      // Dynamic mode - based on prayer time
      if (isFajr) {
        // Use Fajr time
        const fajrTime = todayTimings?.timings?.fajr;
        const tomorrowFajrTime = tomorrowTimings?.timings?.fajr;

        if (!fajrTime && !tomorrowFajrTime) return null;

        const offsetMs = (settings.offsetMinutes || 0) * 60 * 1000;

        // Check today's Fajr
        if (fajrTime) {
          const fajrDate = parseISO(fajrTime);
          const alarmDate = new Date(fajrDate.getTime() + offsetMs);

          if (alarmDate > now) {
            const timeString = format(alarmDate, "HH:mm");
            return {
              time: timeString,
              occurrence: isToday(alarmDate)
                ? t("alarm.card.today", "Today")
                : t("alarm.card.tomorrow", "Tomorrow"),
            };
          }
        }

        // Use tomorrow's Fajr
        if (tomorrowFajrTime) {
          const fajrDate = parseISO(tomorrowFajrTime);
          const alarmDate = new Date(fajrDate.getTime() + offsetMs);
          const timeString = format(alarmDate, "HH:mm");
          return {
            time: timeString,
            occurrence: t("alarm.card.tomorrow", "Tomorrow"),
          };
        }
      } else {
        // Jummah - find next Friday Dhuhr
        const dayOfWeek = now.getDay();
        const daysUntilFriday = dayOfWeek === 5 ? 0 : (5 - dayOfWeek + 7) % 7;

        // Get Dhuhr time for calculating Jummah alarm
        const dhuhrTime = todayTimings?.timings?.dhuhr;
        if (!dhuhrTime) return null;

        const dhuhrDate = parseISO(dhuhrTime);
        const offsetMs = (settings.offsetMinutes || 0) * 60 * 1000;

        if (daysUntilFriday === 0) {
          // Today is Friday
          const alarmDate = new Date(dhuhrDate.getTime() + offsetMs);
          if (alarmDate > now) {
            const timeString = format(alarmDate, "HH:mm");
            return {
              time: timeString,
              occurrence: t("alarm.card.today", "Today"),
            };
          }
          // Friday has passed, next week
          return {
            time: format(new Date(dhuhrDate.getTime() + offsetMs), "HH:mm"),
            occurrence: t("alarm.card.nextFriday", "Next Friday"),
          };
        } else {
          // Calculate next Friday
          return {
            time: format(new Date(dhuhrDate.getTime() + offsetMs), "HH:mm"),
            occurrence: t("alarm.card.friday", "Friday"),
          };
        }
      }
    }

    return null;
  };

  const alarmInfo = getNextAlarmTime();

  // Get quick status text
  const getStatusText = (): string => {
    const parts: string[] = [];
    if (settings.snoozeEnabled) {
      parts.push(t("alarm.card.snoozeEnabled", "Snooze"));
    }
    if (settings.challengeEnabled && settings.challengeType !== "none") {
      const challengeName =
        settings.challengeType === "math"
          ? t("alarm.card.mathChallenge", "Math")
          : t("alarm.card.tapChallenge", "Tap");
      parts.push(challengeName);
    }
    return parts.join(" · ");
  };

  const statusText = getStatusText();

  // Handle card press based on state
  const handleCardPress = () => {
    if (!settings.hasCompletedSetup || !settings.enabled) {
      onPress();
    } else {
      onEditPress();
    }
  };

  // Render not setup state
  if (!settings.hasCompletedSetup) {
    return (
      <Pressable onPress={onPress}>
        <Box className="bg-background-secondary rounded-2xl p-5 mb-4 opacity-70">
          <HStack className="justify-between items-center mb-3">
            <HStack className="items-center gap-3">
              <Icon as={CardIcon} size="xl" className="text-typography-secondary" />
              <Text className="text-xl font-semibold text-typography">
                {isFajr
                  ? t("alarm.fajrPrayer", "Fajr Alarm")
                  : t("alarm.jummahPrayer", "Jummah Alarm")}
              </Text>
            </HStack>
            <Switch
              value={false}
              onValueChange={() => onToggle(true)}
              trackColor={{ false: "#3e3e3e", true: "#4CAF50" }}
            />
          </HStack>

          <HStack className="items-center justify-between">
            <Text className="text-typography-secondary text-base">
              {t("alarm.card.tapToSetup", "Tap to set up")}
            </Text>
            <Icon as={ChevronIcon} size="md" className="text-typography-secondary" />
          </HStack>
        </Box>
      </Pressable>
    );
  }

  // Render enabled/disabled state
  return (
    <Box
      className={`bg-background-secondary rounded-2xl p-5 mb-4 ${
        !settings.enabled ? "opacity-60" : ""
      }`}>
      {/* Header with icon, title, and toggle */}
      <HStack className="justify-between items-center mb-3">
        <HStack className="items-center gap-3">
          <Icon
            as={CardIcon}
            size="xl"
            className={settings.enabled ? "text-primary" : "text-typography-secondary"}
          />
          <Text className="text-xl font-semibold text-typography">
            {isFajr ? t("alarm.fajrPrayer", "Fajr Alarm") : t("alarm.jummahPrayer", "Jummah Alarm")}
          </Text>
        </HStack>
        <Switch
          value={settings.enabled}
          onValueChange={onToggle}
          trackColor={{ false: "#3e3e3e", true: "#4CAF50" }}
        />
      </HStack>

      {/* Time display */}
      {alarmInfo && (
        <Pressable onPress={handleCardPress}>
          <VStack className="mb-2">
            <Text className="text-4xl font-bold text-typography tracking-tight">
              {alarmInfo.time}
            </Text>
            <Text className="text-base text-typography-secondary mt-1">
              {alarmInfo.occurrence}
              {statusText ? ` · ${statusText}` : ""}
            </Text>
          </VStack>

          {/* Actions row */}
          <HStack className="items-center justify-between mt-2">
            {/* Preview button (both platforms) */}
            {settings.enabled && (
              <>
                {previewState === "idle" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={handlePreview}
                    className="border-outline">
                    <HStack className="items-center gap-1">
                      <Icon as={Play} size="xs" className="text-typography-secondary" />
                      <ButtonText className="text-typography-secondary text-xs">
                        {t("alarm.card.preview", "Preview")}
                      </ButtonText>
                    </HStack>
                  </Button>
                )}

                {previewState === "countdown" && (
                  <HStack className="items-center gap-2">
                    <Box className="bg-primary/20 rounded-full px-3 py-1.5">
                      <Text className="text-primary font-bold text-sm">
                        {t("alarm.card.alarmIn", "Alarm in {{seconds}}s", { seconds: countdown })}
                      </Text>
                    </Box>
                    <Pressable
                      onPress={cancelPreview}
                      className="bg-error/20 rounded-full p-1.5"
                      hitSlop={8}>
                      <Icon as={X} size="xs" className="text-error" />
                    </Pressable>
                  </HStack>
                )}

                {previewState === "scheduled" && (
                  <Box className="bg-success/20 rounded-full px-3 py-1.5">
                    <Text className="text-success font-medium text-sm">
                      {t("alarm.card.alarmFiring", "Alarm firing...")}
                    </Text>
                  </Box>
                )}
              </>
            )}
            {!settings.enabled && <Box />}

            {/* Edit button */}
            <HStack className="items-center">
              <Text className="text-primary font-medium">{t("alarm.card.edit", "Edit")}</Text>
              <Icon as={ChevronIcon} size="sm" className="text-primary" />
            </HStack>
          </HStack>
        </Pressable>
      )}
    </Box>
  );
};

export default AlarmCard;
