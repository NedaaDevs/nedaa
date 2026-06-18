import { ScrollView } from "react-native";
import { YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { useQuranRemindersStore } from "@/stores/quranReminders";
import { ReminderRow } from "@/components/quran/library/ReminderRow";

// The reader's reminders hub: a short intro and a row per reminder. Al-Kahf is
// the only entry today; future reminders (e.g. khatmah pace) stack here.
export const RemindersTab = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const chrome = useQuranChromeColors();
  const reminders = useQuranRemindersStore((s) => s.reminders);

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}>
      <YStack gap="$2">
        <Text fontSize={13} color={chrome.subtleText} paddingHorizontal="$2" paddingBottom="$2">
          {t("quran.reminders.intro")}
        </Text>
        {reminders.map((reminder) => (
          <ReminderRow key={reminder.id} reminder={reminder} />
        ))}
      </YStack>
    </ScrollView>
  );
};
