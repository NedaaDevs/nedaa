import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  ScrollView,
  Text,
  View,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { BookmarkColor, HighlightColor, QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS, QURAN_TEXT_FONT } from "@/constants/Quran";
import { AyahTextData } from "@/types/quran";
import { QuranContentDB } from "@/services/quran-content-db";
import { useHighlightStore } from "@/stores/quranHighlights";
import { useBookmarkStore } from "@/stores/quranBookmarks";
import { juzForPage } from "@/utils/juz";
import { localizedSurahName, metadataFontFamily } from "@/utils/surahName";
import AyahText from "@/components/quran/AyahText";
import PageHeader from "@/components/quran/PageHeader";
import PageNumber from "@/components/quran/PageNumber";

interface TextPageProps {
  page: number;
  quranTheme: QuranTheme;
  fontSize: number;
  onAyahLongPress?: (surah: number, ayah: number) => void;
  selectedAyah?: { surah: number; ayah: number } | null;
}

const BASMALA =
  "\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0651\u064E\u0647\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0640\u0670\u0646\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650";

const NO_BASMALA_SURAHS = [1, 9];

const TextPage = ({ page, quranTheme, fontSize, onAyahLongPress, selectedAyah }: TextPageProps) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const [ayahs, setAyahs] = useState<AyahTextData[]>([]);
  const [surahName, setSurahName] = useState("");
  const [juz, setJuz] = useState(1);
  const [highlightedAyah, setHighlightedAyah] = useState<{
    surah: number;
    ayah: number;
  } | null>(null);

  const highlights = useHighlightStore((s) => s.highlights);
  const highlightMap = useMemo(() => {
    const map = new Map<string, HighlightColor>();
    for (const h of highlights) map.set(`${h.surah}:${h.ayah}`, h.color);
    return map;
  }, [highlights]);

  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const bookmarkMap = useMemo(() => {
    const map = new Map<string, BookmarkColor>();
    for (const b of bookmarks) map.set(`${b.surah}:${b.ayah}`, b.color);
    return map;
  }, [bookmarks]);

  useEffect(() => {
    const loadData = async () => {
      const pageAyahs = await QuranContentDB.getAyahsForPage(page);
      const juzNumber = juzForPage(page);
      setAyahs(pageAyahs);
      setJuz(juzNumber);
      AccessibilityInfo.announceForAccessibility(`Page ${page}, Juz ${juzNumber}`);

      if (pageAyahs.length > 0) {
        setSurahName(localizedSurahName(pageAyahs[0].surahNumber));
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlightedAyah(null);
  }, [page]);

  const handleLongPress = useCallback(
    (surahNumber: number, ayahNumber: number) => {
      setHighlightedAyah({ surah: surahNumber, ayah: ayahNumber });
      onAyahLongPress?.(surahNumber, ayahNumber);
    },
    [onAyahLongPress]
  );

  // Drop the highlight when the ayah's action sheet closes (selection cleared).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!selectedAyah) setHighlightedAyah(null);
  }, [selectedAyah]);

  // Group consecutive ayahs by surah and flow each group as one justified block
  // so verses run continuously.
  const renderContent = () => {
    const blocks: React.ReactNode[] = [];
    let i = 0;
    while (i < ayahs.length) {
      const surah = ayahs[i].surahNumber;
      const group: AyahTextData[] = [];
      while (i < ayahs.length && ayahs[i].surahNumber === surah) {
        group.push(ayahs[i]);
        i++;
      }

      if (group[0].ayahNumber === 1) {
        blocks.push(
          <View key={`surah-header-${surah}`} style={styles.surahHeader}>
            <Text
              style={[
                styles.surahHeaderText,
                {
                  color: themeColors.headerColor,
                  fontSize: fontSize * 0.9,
                  fontFamily: metadataFontFamily(),
                },
              ]}
              accessibilityRole="header">
              {t("quran.goto.surah")} {localizedSurahName(surah)}
            </Text>
            {!NO_BASMALA_SURAHS.includes(surah) && (
              <Text
                style={[
                  styles.basmala,
                  {
                    color: themeColors.textTint ?? "#000",
                    fontSize: fontSize * 0.85,
                    fontFamily: QURAN_TEXT_FONT,
                  },
                ]}>
                {BASMALA}
              </Text>
            )}
          </View>
        );
      }

      blocks.push(
        <Text
          key={`surah-flow-${surah}`}
          style={{
            fontSize,
            lineHeight: fontSize * 2,
            color: themeColors.textTint ?? "#000",
            fontFamily: QURAN_TEXT_FONT,
            textAlign: "justify",
            writingDirection: "rtl",
            marginBottom: 14,
          }}>
          {group.map((ayah) => (
            <AyahText
              key={`${surah}-${ayah.ayahNumber}`}
              surahNumber={surah}
              ayahNumber={ayah.ayahNumber}
              text={ayah.text}
              quranTheme={quranTheme}
              isHighlighted={
                highlightedAyah?.surah === surah && highlightedAyah?.ayah === ayah.ayahNumber
              }
              highlightColor={highlightMap.get(`${surah}:${ayah.ayahNumber}`) ?? null}
              bookmarkColor={bookmarkMap.get(`${surah}:${ayah.ayahNumber}`) ?? null}
              onLongPress={handleLongPress}
            />
          ))}
        </Text>
      );
    }

    return blocks;
  };

  return (
    <YStack flex={1} width={width} style={{ backgroundColor: themeColors.background }}>
      <PageHeader surahName={surahName} juz={juz} quranTheme={quranTheme} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: 18, paddingBottom: insets.bottom + 48 },
        ]}
        showsVerticalScrollIndicator={false}>
        {renderContent()}
      </ScrollView>

      <PageNumber page={page} quranTheme={quranTheme} />
    </YStack>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
  },
  surahHeader: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
  surahHeaderText: {
    textAlign: "center",
    fontWeight: "600",
    writingDirection: "rtl",
  },
  basmala: {
    textAlign: "center",
    writingDirection: "rtl",
  },
  tooltip: {
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  tooltipText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});

export default TextPage;
