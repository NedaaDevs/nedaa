import { useCallback, useEffect, useState } from "react";
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

import { QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS, QURAN_FONT_FAMILY, SURAH_NAMES } from "@/constants/Quran";
import { AyahTextData } from "@/types/quran";
import { QuranContentDB } from "@/services/quran-content-db";
import AyahText from "@/components/quran/AyahText";
import PageHeader from "@/components/quran/PageHeader";
import PageNumber from "@/components/quran/PageNumber";

interface TextPageProps {
  page: number;
  quranTheme: QuranTheme;
  fontSize: number;
}

const BASMALA =
  "\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0651\u064E\u0647\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0640\u0670\u0646\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650";

const NO_BASMALA_SURAHS = [1, 9];

const TextPage = ({ page, quranTheme, fontSize }: TextPageProps) => {
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

  useEffect(() => {
    const loadData = async () => {
      const [pageAyahs, juzNumber] = await Promise.all([
        QuranContentDB.getAyahsForPage(page),
        QuranContentDB.getJuzForPage(page),
      ]);
      setAyahs(pageAyahs);
      setJuz(juzNumber);
      AccessibilityInfo.announceForAccessibility(`Page ${page}, Juz ${juzNumber}`);

      if (pageAyahs.length > 0) {
        setSurahName(SURAH_NAMES[pageAyahs[0].surahNumber] ?? String(pageAyahs[0].surahNumber));
      }
    };
    loadData();
    setHighlightedAyah(null);
  }, [page]);

  const handleLongPress = useCallback((surahNumber: number, ayahNumber: number) => {
    setHighlightedAyah((prev) =>
      prev?.surah === surahNumber && prev?.ayah === ayahNumber
        ? null
        : { surah: surahNumber, ayah: ayahNumber }
    );
  }, []);

  const renderContent = () => {
    const elements: React.ReactNode[] = [];
    let lastSurah = 0;

    for (const ayah of ayahs) {
      if (ayah.surahNumber !== lastSurah && ayah.ayahNumber === 1) {
        elements.push(
          <View key={`surah-header-${ayah.surahNumber}`} style={styles.surahHeader}>
            <Text
              style={[
                styles.surahHeaderText,
                {
                  color: themeColors.headerColor,
                  fontSize: fontSize * 0.9,
                  fontFamily: QURAN_FONT_FAMILY,
                },
              ]}
              accessibilityRole="header">
              سورة {SURAH_NAMES[ayah.surahNumber] ?? ayah.surahNumber}
            </Text>
            {!NO_BASMALA_SURAHS.includes(ayah.surahNumber) && (
              <Text
                style={[
                  styles.basmala,
                  {
                    color: themeColors.textTint ?? "#000",
                    fontSize: fontSize * 0.85,
                    fontFamily: QURAN_FONT_FAMILY,
                  },
                ]}>
                {BASMALA}
              </Text>
            )}
          </View>
        );
      }
      lastSurah = ayah.surahNumber;

      elements.push(
        <AyahText
          key={`${ayah.surahNumber}-${ayah.ayahNumber}`}
          surahNumber={ayah.surahNumber}
          ayahNumber={ayah.ayahNumber}
          text={ayah.text}
          fontSize={fontSize}
          quranTheme={quranTheme}
          isHighlighted={
            highlightedAyah?.surah === ayah.surahNumber && highlightedAyah?.ayah === ayah.ayahNumber
          }
          onLongPress={handleLongPress}
        />
      );
    }

    return elements;
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

        {highlightedAyah && (
          <View style={[styles.tooltip, { backgroundColor: themeColors.headerColor }]}>
            <Text style={[styles.tooltipText, { color: themeColors.background }]}>
              {highlightedAyah.surah}:{highlightedAyah.ayah}
            </Text>
          </View>
        )}
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
