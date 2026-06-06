import { useMemo, useState } from "react";
import { Pressable, ScrollView } from "react-native";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, ArrowRight, Check, Pencil } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_ORDER } from "@/constants/Quran";
import { HighlightColor } from "@/enums/quran";
import { useHighlightStore } from "@/stores/quranHighlights";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { useRTL } from "@/contexts/RTLContext";
import { formatNumberToLocale } from "@/utils/number";

// Colour-label manager — the 7 highlight colours with verse counts + inline
// rename. Embeddable (no frame) so it serves as a standalone route and the
// "Colours" view inside the Library's Highlights tab.
export const HighlightColors = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const chrome = useQuranChromeColors();

  const highlights = useHighlightStore((s) => s.highlights);
  const labels = useHighlightStore((s) => s.labels);
  const setLabel = useHighlightStore((s) => s.setLabel);

  const [editing, setEditing] = useState<HighlightColor | null>(null);
  const [draft, setDraft] = useState("");

  const counts = useMemo(() => {
    const map = new Map<HighlightColor, number>();
    for (const h of highlights) map.set(h.color, (map.get(h.color) ?? 0) + 1);
    return map;
  }, [highlights]);

  const startEdit = (color: HighlightColor) => {
    setDraft(labels[color] ?? "");
    setEditing(color);
  };
  const commit = () => {
    if (editing) setLabel(editing, draft);
    setEditing(null);
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled">
      {HIGHLIGHT_COLOR_ORDER.map((color, i) => {
        const isEditing = editing === color;
        const count = counts.get(color) ?? 0;
        const name = labels[color] ?? t(`quran.highlight.color.${color}`);
        return (
          <XStack
            key={color}
            alignItems="center"
            gap="$3"
            paddingVertical="$3"
            paddingHorizontal="$2"
            borderBottomWidth={i < HIGHLIGHT_COLOR_ORDER.length - 1 ? 1 : 0}
            borderBottomColor="$borderColor">
            <YStack
              width={26}
              height={26}
              borderRadius={13}
              backgroundColor={HIGHLIGHT_COLORS[color].solid}
            />
            {isEditing ? (
              <XStack flex={1} alignItems="center" gap="$2">
                <Input
                  flex={1}
                  size="$4"
                  height={48}
                  fontSize={16}
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={commit}
                  autoFocus
                  maxLength={24}
                  placeholder={t(`quran.highlight.color.${color}`)}
                  accessibilityLabel={t("quran.highlight.renameLabel")}
                />
                <Pressable
                  onPress={commit}
                  accessibilityRole="button"
                  accessibilityLabel={t("common.save")}
                  hitSlop={8}
                  style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
                  <Check color={chrome.accent} size={24} />
                </Pressable>
              </XStack>
            ) : (
              <Pressable
                onPress={() => startEdit(color)}
                accessibilityRole="button"
                accessibilityLabel={name}
                accessibilityHint={t("quran.highlight.renameHint")}
                style={{ flex: 1, minHeight: 44, justifyContent: "center" }}>
                <XStack alignItems="center">
                  <YStack flex={1}>
                    <Text fontSize={15} fontWeight="600" color={chrome.text}>
                      {name}
                    </Text>
                    <Text fontSize={12} color={chrome.subtleText}>
                      {count === 0
                        ? t("quran.highlight.noVerses")
                        : t("quran.highlight.verseCount", {
                            count: formatNumberToLocale(String(count)),
                          })}
                    </Text>
                  </YStack>
                  <Pencil color={chrome.subtleText} size={17} />
                </XStack>
              </Pressable>
            )}
          </XStack>
        );
      })}

      <Text
        fontSize={12}
        color={chrome.subtleText}
        paddingHorizontal="$2"
        paddingTop="$4"
        lineHeight={18}>
        {t("quran.highlight.manageNote")}
      </Text>
    </ScrollView>
  );
};

// Standalone route wrapper — frames HighlightColors with a back header.
const QuranHighlightsScreen = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const chrome = useQuranChromeColors();
  const { isRTL } = useRTL();
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
      <StatusBar style="auto" />
      <XStack
        alignItems="center"
        gap="$3"
        paddingHorizontal="$3"
        paddingVertical="$2"
        borderBottomWidth={1}
        borderBottomColor="$borderColor">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          hitSlop={8}
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <BackIcon color={chrome.accent} size={24} />
        </Pressable>
        <YStack flex={1}>
          <Text fontSize={17} fontWeight="700" color={chrome.text}>
            {t("quran.highlight.manageTitle")}
          </Text>
          <Text fontSize={12} color={chrome.subtleText}>
            {t("quran.highlight.manageSubtitle")}
          </Text>
        </YStack>
      </XStack>
      <HighlightColors />
    </YStack>
  );
};

export default QuranHighlightsScreen;
