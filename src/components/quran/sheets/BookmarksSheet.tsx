import { useMemo } from "react";
import { Pressable, ScrollView, useWindowDimensions } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { ChevronRight, Trash2 } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { BOOKMARK_COLORS, QURAN_THEME_COLORS } from "@/constants/Quran";
import { QuranTheme } from "@/enums/quran";
import { useBookmarkStore } from "@/stores/quranBookmarks";
import { localizedSurahName, metadataFontFamily } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";
import ReaderSheet from "@/components/quran/sheets/ReaderSheet";

interface BookmarksSheetProps {
  quranTheme: QuranTheme;
  onNavigate: (page: number) => void;
  onClose: () => void;
}

const BookmarksSheet = ({ quranTheme, onNavigate, onClose }: BookmarksSheetProps) => {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const c = QURAN_THEME_COLORS[quranTheme];
  const ink = c.textTint ?? c.headerColor;
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const removeBookmark = useBookmarkStore((s) => s.removeBookmark);

  const rows = useMemo(
    () => [...bookmarks].sort((a, b) => a.surah - b.surah || a.ayah - b.ayah),
    [bookmarks]
  );

  return (
    <ReaderSheet onClose={onClose} quranTheme={quranTheme}>
      <Text fontSize={16} fontWeight="700" color={c.headerColor} paddingBottom="$2">
        {t("quran.bookmark.title")}
      </Text>

      {rows.length === 0 ? (
        <YStack paddingVertical="$6" alignItems="center">
          <Text fontSize={14} color={c.pageNumberColor}>
            {t("quran.bookmark.empty")}
          </Text>
        </YStack>
      ) : (
        <ScrollView style={{ maxHeight: height * 0.55 }} showsVerticalScrollIndicator={false}>
          <YStack paddingTop="$1" gap="$2">
            {rows.map((b) => (
              <XStack
                key={`${b.surah}:${b.ayah}`}
                alignItems="stretch"
                borderRadius={12}
                borderWidth={1}
                borderColor={c.frameColor}
                overflow="hidden">
                {/* Colour stripe */}
                <YStack width={5} backgroundColor={BOOKMARK_COLORS[b.color].solid} />
                <Pressable
                  onPress={() => {
                    onNavigate(b.page);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t("a11y.quran.ayahText", { surah: b.surah, ayah: b.ayah })}
                  accessibilityHint={t("quran.bookmark.goHint")}
                  style={{ flex: 1 }}>
                  <XStack
                    alignItems="center"
                    gap="$2"
                    paddingVertical="$2.5"
                    paddingHorizontal="$3">
                    <YStack flex={1} gap="$1">
                      <XStack alignItems="center" gap="$2">
                        <Text
                          fontSize={15}
                          fontWeight="700"
                          color={ink}
                          style={{ fontFamily: metadataFontFamily() }}>
                          {localizedSurahName(b.surah)}
                        </Text>
                        <Text fontSize={11} color={c.pageNumberColor}>
                          {t(`quran.bookmark.color.${b.color}`)}
                        </Text>
                      </XStack>
                      <Text fontSize={12} color={c.pageNumberColor}>
                        {formatNumberToLocale(String(b.surah))}:
                        {formatNumberToLocale(String(b.ayah))}
                        {" · "}
                        {t("quran.bookmark.page", { page: formatNumberToLocale(String(b.page)) })}
                      </Text>
                    </YStack>
                    <ChevronRight size={18} color={c.pageNumberColor} />
                  </XStack>
                </Pressable>
                <Pressable
                  onPress={() => removeBookmark(b.surah, b.ayah)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t("quran.bookmark.remove")}
                  style={{ paddingHorizontal: 12, justifyContent: "center" }}>
                  <Trash2 size={16} color={c.pageNumberColor} />
                </Pressable>
              </XStack>
            ))}
          </YStack>
        </ScrollView>
      )}
    </ReaderSheet>
  );
};

export default BookmarksSheet;
