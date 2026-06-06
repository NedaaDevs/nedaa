import { Pressable, ScrollView } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { BOOKMARK_COLORS, BOOKMARK_COLOR_ORDER } from "@/constants/Quran";
import { useBookmarkStore } from "@/stores/quranBookmarks";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { useRTL } from "@/contexts/RTLContext";
import { localizedSurahName } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";
import RibbonGlyph from "@/components/quran/RibbonGlyph";

// The 4 ribbon slots and where each currently sits; tap an in-use one to jump.
export const BookmarksTab = ({ onNavigate }: { onNavigate: (page: number) => void }) => {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const chrome = useQuranChromeColors();
  const { isRTL } = useRTL();
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleString(i18n.language, {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}>
      {BOOKMARK_COLOR_ORDER.map((color, i) => {
        const at = bookmarks.find((b) => b.color === color);
        const name = t(`quran.bookmark.color.${color}`);
        return (
          <Pressable
            key={color}
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
            }>
            <XStack
              alignItems="center"
              gap="$3"
              paddingVertical="$3"
              paddingHorizontal="$2"
              borderBottomWidth={i < BOOKMARK_COLOR_ORDER.length - 1 ? 1 : 0}
              borderBottomColor="$borderColor"
              opacity={at ? 1 : 0.5}>
              <RibbonGlyph
                size={28}
                color={at ? BOOKMARK_COLORS[color].solid : chrome.subtleText}
                outlined={!at}
              />
              <YStack flex={1}>
                <Text fontSize={15} fontWeight="600" color={chrome.text}>
                  {name}
                </Text>
                {at && (
                  <Text fontSize={12} color={chrome.subtleText}>
                    {`${localizedSurahName(at.surah)} ${formatNumberToLocale(String(at.ayah))} · ${fmtDate(at.createdAt)}`}
                  </Text>
                )}
              </YStack>
              {at && <Chevron color={chrome.subtleText} size={18} />}
            </XStack>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};
