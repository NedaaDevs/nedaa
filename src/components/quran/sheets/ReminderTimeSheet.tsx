import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import appStore from "@/stores/app";

const toDate = (hour: number, minute: number): Date => new Date(2000, 0, 1, hour, minute, 0, 0);

type Props = {
  visible: boolean;
  title: string;
  hour: number;
  minute: number;
  onConfirm: (hour: number, minute: number) => void;
  onClose: () => void;
};

// A themed time picker for reminders, wrapping the native wheel so it inherits
// the reader's reading theme and the device's locale (Arabic numerals, AM/PM).
// iOS shows an inline spinner in a bottom card; Android uses its native dialog.
export const ReminderTimeSheet = ({ visible, title, hour, minute, onConfirm, onClose }: Props) => {
  const { t } = useTranslation();
  const chrome = useQuranChromeColors();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(() => toDate(hour, minute));

  useEffect(() => {
    if (visible) setDraft(toDate(hour, minute));
  }, [visible, hour, minute]);

  if (!visible) return null;

  if (Platform.OS === "android") {
    return (
      <DateTimePicker
        value={draft}
        mode="time"
        display="default"
        onChange={(event: DateTimePickerEvent, date?: Date) => {
          onClose();
          if (event.type === "set" && date) onConfirm(date.getHours(), date.getMinutes());
        }}
      />
    );
  }

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.card,
            { backgroundColor: chrome.cardBackground, paddingBottom: insets.bottom + 16 },
          ]}>
          <Text fontSize={16} fontWeight="700" color={chrome.text} textAlign="center">
            {title}
          </Text>

          <View style={styles.picker}>
            <DateTimePicker
              value={draft}
              mode="time"
              display="spinner"
              locale={appStore.getState().locale}
              textColor={chrome.text}
              onChange={(_event: DateTimePickerEvent, date?: Date) => date && setDraft(date)}
            />
          </View>

          <Pressable
            onPress={() => onConfirm(draft.getHours(), draft.getMinutes())}
            accessibilityRole="button"
            accessibilityLabel={t("common.confirm")}
            style={[styles.confirm, { backgroundColor: chrome.accent }]}>
            <Text fontSize={16} fontWeight="600" color={chrome.cardBackground}>
              {t("common.confirm")}
            </Text>
          </Pressable>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
            style={styles.cancel}>
            <Text fontSize={15} fontWeight="500" color={chrome.subtleText}>
              {t("common.cancel")}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  picker: { alignItems: "center", marginVertical: 8 },
  confirm: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cancel: { height: 48, alignItems: "center", justifyContent: "center", marginTop: 4 },
});
