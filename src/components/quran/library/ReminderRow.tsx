import { useState } from "react";
import { Pressable } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { Bell, Clock } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { Switch } from "@/components/ui/switch";
import { ReminderTimeSheet } from "@/components/quran/sheets/ReminderTimeSheet";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { useQuranRemindersStore } from "@/stores/quranReminders";
import { ensureReminderPermission } from "@/hooks/useReminderPermission";
import { applyReminderToggle } from "@/utils/reminders/applyReminderToggle";
import { computeNextOccurrence } from "@/utils/reminders/computeNextOccurrence";
import { formatTime12Hour } from "@/utils/date";
import type { QuranReminder } from "@/types/quranReminders";

// One Quran reminder as a card: an icon, its schedule, a switch to arm it, and —
// once on — an editable time pill plus the next fire date as the non-colour state
// cue. Enabling primes notification permission first and reverts to a recovery
// hint if the OS denies it.
export const ReminderRow = ({ reminder }: { reminder: QuranReminder }) => {
  const { t, i18n } = useTranslation();
  const chrome = useQuranChromeColors();
  const setEnabled = useQuranRemindersStore((s) => s.setEnabled);
  const setTime = useQuranRemindersStore((s) => s.setTime);

  const [showTimePicker, setShowTimePicker] = useState(false);
  const [denied, setDenied] = useState(false);

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
  const title = t("quran.reminders.alKahf.title");

  return (
    <YStack
      backgroundColor={chrome.cardBackground}
      borderColor={chrome.cardBorder}
      borderWidth={1}
      borderRadius="$6"
      padding="$4"
      gap="$3">
      <XStack alignItems="center" gap="$3">
        <YStack
          width={40}
          height={40}
          borderRadius={20}
          alignItems="center"
          justifyContent="center"
          backgroundColor={`${chrome.accent}22`}>
          <Bell color={chrome.accent} size={20} />
        </YStack>

        <YStack flex={1} gap="$1">
          <Text fontSize={16} fontWeight="700" color={chrome.text}>
            {title}
          </Text>
          <Text fontSize={13} color={chrome.subtleText}>
            {reminder.enabled ? scheduleLabel : t("quran.reminders.day.friday")}
          </Text>
        </YStack>

        <Switch
          value={reminder.enabled}
          onValueChange={handleToggle}
          accessibilityLabel={t("a11y.quran.reminders.toggle")}
        />
      </XStack>

      {reminder.enabled && (
        <YStack gap="$2" borderTopColor={chrome.cardBorder} borderTopWidth={1} paddingTop="$3">
          <XStack alignItems="center" justifyContent="space-between">
            <Text fontSize={13} color={chrome.subtleText}>
              {nextLabel}
            </Text>
            <Pressable
              onPress={() => setShowTimePicker(true)}
              accessibilityRole="button"
              accessibilityLabel={t("a11y.quran.reminders.editTime")}
              style={{ minHeight: 44, justifyContent: "center" }}>
              <XStack
                alignItems="center"
                gap="$2"
                paddingVertical={6}
                paddingHorizontal={12}
                borderRadius={999}
                backgroundColor={`${chrome.accent}1A`}>
                <Clock color={chrome.accent} size={15} />
                <Text fontSize={15} fontWeight="600" color={chrome.accent}>
                  {time}
                </Text>
              </XStack>
            </Pressable>
          </XStack>
        </YStack>
      )}

      {denied && (
        <Text fontSize={12} color={chrome.accentWarning}>
          {t("quran.reminders.permission.denied")}
        </Text>
      )}

      <ReminderTimeSheet
        visible={showTimePicker}
        title={title}
        hour={reminder.schedule.hour}
        minute={reminder.schedule.minute}
        onConfirm={handleTimeChange}
        onClose={() => setShowTimePicker(false)}
      />
    </YStack>
  );
};
