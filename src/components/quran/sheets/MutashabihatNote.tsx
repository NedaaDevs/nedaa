import { useEffect, useRef, useState } from "react";
import { Pressable } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { Pencil, Check, X } from "lucide-react-native";

import { Text } from "@/components/ui/text";

const MAX_LENGTH = 280;

// A personal memory note per similar-verse group: auto-grows, shows a focus ring,
// flashes "saved" as you type, and offers a character count + clear action.
export const MutashabihatNote = ({
  value,
  onChange,
  ink,
  subtle,
  border,
  surface,
  isArabic,
}: {
  value: string;
  onChange: (text: string) => void;
  ink: `#${string}`;
  subtle: `#${string}`;
  border: `#${string}`;
  surface: `#${string}`;
  isArabic: boolean;
}) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const [savedShown, setSavedShown] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The parent keys this component by group id, so it remounts (fresh draft) when
  // the group changes — no prop→state syncing needed here.
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const commit = (text: string) => {
    const next = text.slice(0, MAX_LENGTH);
    setDraft(next);
    onChange(next);
    setSavedShown(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedShown(false), 1500);
  };

  return (
    <YStack gap="$1.5" paddingTop="$1">
      <XStack alignItems="center" gap="$2">
        <Pencil size={13} color={subtle} />
        <Text fontSize={12} fontWeight="700" color={subtle} flex={1}>
          {t("quran.mutashabihat.note.label")}
        </Text>
        {savedShown && (
          <XStack alignItems="center" gap="$1">
            <Check size={12} color={subtle} />
            <Text fontSize={11} color={subtle}>
              {t("quran.mutashabihat.note.saved")}
            </Text>
          </XStack>
        )}
      </XStack>

      <YStack
        borderRadius={12}
        borderWidth={1.5}
        borderColor={focused ? ink : border}
        paddingHorizontal="$3"
        paddingTop="$2.5"
        paddingBottom="$2"
        style={{ backgroundColor: surface }}>
        <BottomSheetTextInput
          value={draft}
          onChangeText={commit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={t("quran.mutashabihat.note.placeholder")}
          placeholderTextColor={subtle}
          multiline
          scrollEnabled={false}
          style={{
            minHeight: 48,
            fontSize: 14,
            lineHeight: 22,
            padding: 0,
            color: ink,
            textAlign: isArabic ? "right" : "left",
            writingDirection: isArabic ? "rtl" : "ltr",
          }}
        />

        <XStack alignItems="center" marginTop="$2">
          {draft.length > 0 ? (
            <Pressable
              onPress={() => commit("")}
              accessibilityRole="button"
              accessibilityLabel={t("quran.mutashabihat.note.clear")}
              hitSlop={8}>
              <XStack alignItems="center" gap="$1">
                <X size={12} color={subtle} />
                <Text fontSize={11} fontWeight="600" color={subtle}>
                  {t("quran.mutashabihat.note.clear")}
                </Text>
              </XStack>
            </Pressable>
          ) : null}
          <YStack flex={1} />
          <Text fontSize={11} color={subtle}>
            {draft.length}/{MAX_LENGTH}
          </Text>
        </XStack>
      </YStack>
    </YStack>
  );
};
