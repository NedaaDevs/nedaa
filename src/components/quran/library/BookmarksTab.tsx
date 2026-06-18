import { useState } from "react";
import { Pressable, ScrollView } from "react-native";
import { XStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronLeft, ChevronRight, Pencil } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { BOOKMARK_COLORS, BOOKMARK_COLOR_ORDER } from "@/constants/Quran";
import { BookmarkColor } from "@/enums/quran";
import { useBookmarkStore } from "@/stores/quranBookmarks";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { useRTL } from "@/contexts/RTLContext";
import { localizedSurahName } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";
import RibbonGlyph from "@/components/quran/RibbonGlyph";

// The 4 ribbon slots and where each currently sits; tap an in-use one to jump, or
// the pencil to rename it (a custom name like "Revision" follows the ribbon).
export const BookmarksTab = ({ onNavigate }: { onNavigate: (page: number) => void }) => {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const chrome = useQuranChromeColors();
  const { isRTL } = useRTL();
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const labels = useBookmarkStore((s) => s.labels);
  const setLabel = useBookmarkStore((s) => s.setLabel);
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const [editing, setEditing] = useState<BookmarkColor | null>(null);
  const [draft, setDraft] = useState("");
  const startEdit = (color: BookmarkColor) => {
    setDraft(labels[color] ?? "");
    setEditing(color);
  };
  const commit = () => {
    if (editing) setLabel(editing, draft);
    setEditing(null);
  };

  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleString(i18n.language, {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <ScrollView
      contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled">
      {BOOKMARK_COLOR_ORDER.map((color, i) => {
        const at = bookmarks.find((b) => b.color === color);
        const name = labels[color] ?? t(`quran.bookmark.color.${color}`);
        const defaultName = t(`quran.bookmark.color.${color}`);
        const isEditing = editing === color;
        return (
          <XStack
            key={color}
            alignItems="center"
            gap="$3"
            paddingVertical="$3"
            paddingHorizontal="$2"
            borderBottomWidth={i < BOOKMARK_COLOR_ORDER.length - 1 ? 1 : 0}
            borderBottomColor="$borderColor">
            {/* Always the ribbon's real colour, placed or free; outline marks free. */}
            <RibbonGlyph size={28} color={BOOKMARK_COLORS[color].solid} outlined={!at} />

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
                  placeholder={defaultName}
                  accessibilityLabel={t("quran.bookmark.renameLabel")}
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
              <>
                <Pressable
                  disabled={!at}
                  onPress={() => at && onNavigate(at.page)}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !at }}
                  accessibilityLabel={
                    at
                      ? t("quran.bookmark.ribbonAt", {
                          surah: localizedSurahName(at.surah),
                          ayah: formatNumberToLocale(String(at.ayah)),
                        })
                      : t("quran.bookmark.freeRibbon")
                  }
                  style={{ flex: 1, minHeight: 44, justifyContent: "center" }}>
                  <Text fontSize={15} fontWeight="600" color={chrome.text}>
                    {name}
                  </Text>
                  {at && (
                    <Text fontSize={12} color={chrome.subtleText}>
                      {`${localizedSurahName(at.surah)} ${formatNumberToLocale(String(at.ayah))} · ${fmtDate(at.createdAt)}`}
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => startEdit(color)}
                  accessibilityRole="button"
                  accessibilityLabel={t("quran.bookmark.renameHint")}
                  hitSlop={8}
                  style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}>
                  <Pencil color={chrome.subtleText} size={17} />
                </Pressable>

                {at && <Chevron color={chrome.subtleText} size={18} />}
              </>
            )}
          </XStack>
        );
      })}
    </ScrollView>
  );
};
