import { useState } from "react";
import { Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import TimePicker from "@/components/TimePicker";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { useRTL } from "@/contexts/RTLContext";
import { useQuranRemindersStore } from "@/stores/quranReminders";
import { ensureReminderPermission } from "@/hooks/useReminderPermission";
import { applyReminderToggle } from "@/utils/reminders/applyReminderToggle";
import { computeNextOccurrence } from "@/utils/reminders/computeNextOccurrence";
import { formatTime12Hour } from "@/utils/date";
import type { QuranReminder } from "@/types/quranReminders";

// One Quran reminder: a switch to arm it, a tappable time, and — once on — the
// next fire date as the non-colour state cue. Enabling primes notification
// permission first and reverts to a recovery hint if the OS denies it.
export const ReminderRow = ({ reminder }: { reminder: QuranReminder }) => {
  const { t, i18n } = useTranslation();
  const chrome = useQuranChromeColors();
  const { isRTL } = useRTL();
  const setEnabled = useQuranRemindersStore((s) => s.setEnabled);
  const setTime = useQuranRemindersStore((s) => s.setTime);

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [denied, setDenied] = useState(false);
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const handleToggle = async (next: boolean) => {
    const result = await applyReminderToggle(next, {
      ensure: ensureReminderPermission,
      setEnabled: (enabled) => setEnabled(reminder.id, enabled),
    });
    setDenied(result.denied);
  };

  const handleTimeChange = (hour: number, minute: number) => {
    setTime(reminder.id, hour, minute);
    setShowTimePicker(false);
  };

  const time = formatTime12Hour(reminder.schedule.hour, reminder.schedule.minute);
  const scheduleLabel = t("quran.reminders.schedule.weekly", {
    day: t("quran.reminders.day.friday"),
    time,
  });
  const nextLabel = t("quran.reminders.next", {
    date: computeNextOccurrence(reminder.schedule, new Date()).toLocaleDateString(i18n.language, {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
  });

  return (
    <YStack paddingVertical="$3" paddingHorizontal="$2" gap="$2">
      <XStack alignItems="center" gap="$3">
        <YStack flex={1} gap="$1">
          <Text fontSize={15} fontWeight="600" color={chrome.text}>
            {t("quran.reminders.alKahf.title")}
          </Text>
          <Text fontSize={12} color={chrome.subtleText}>
            {scheduleLabel}
          </Text>
        </YStack>
        <Switch
          value={reminder.enabled}
          onValueChange={handleToggle}
          accessibilityLabel={t("a11y.quran.reminders.toggle")}
        />
      </XStack>

      {reminder.enabled && (
        <Pressable
          onPress={() => setShowTimePicker(true)}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.quran.reminders.editTime")}
          style={{ minHeight: 44, justifyContent: "center" }}>
          <XStack alignItems="center" gap="$2">
            <Text fontSize={13} color={chrome.accent} fontWeight="500">
              {nextLabel}
            </Text>
            <Chevron color={chrome.subtleText} size={16} />
          </XStack>
        </Pressable>
      )}

      {denied && (
        <Text fontSize={12} color={chrome.accentWarning}>
          {t("quran.reminders.permission.denied")}
        </Text>
      )}

      <TimePicker
        isVisible={showTimePicker}
        currentHour={reminder.schedule.hour}
        currentMinute={reminder.schedule.minute}
        use12HourFormat
        isPM={reminder.schedule.hour >= 12}
        onTimeChange={handleTimeChange}
        onClose={() => setShowTimePicker(false)}
      />
    </YStack>
  );
};
