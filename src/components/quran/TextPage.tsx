import { useCallback, useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import { YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import {
  BookmarkColor,
  HighlightColor,
  OrnamentAsset,
  OrnamentCategory,
  QuranThemeType,
  ReadAlongGranularity,
} from "@/enums/quran";
import { BUNDLED_ORNAMENT_META, QURAN_THEME_COLORS, QURAN_TEXT_FONT } from "@/constants/Quran";
import SurahFrame from "@/components/quran/SurahFrame";
import { effectiveOrnamentStyle } from "@/utils/quranOrnaments";
import { AyahTextData } from "@/types/quran";
import { QuranContentDB } from "@/services/quran-content-db";
import { useHighlightStore } from "@/stores/quranHighlights";
import { useBookmarkStore } from "@/stores/quranBookmarks";
import { useQuranStore } from "@/stores/quran";
import { useQuranAudioStore } from "@/stores/quranAudio";
import { QURAN_PLAYER_STATE, QURAN_QUEUE_KIND } from "@/types/quran-audio";
import { useMutashabihatKeys } from "@/hooks/useMutashabihatKeys";
import { juzForPage } from "@/utils/juz";
import { localizedSurahName, metadataFontFamily } from "@/utils/surahName";
import AyahText from "@/components/quran/AyahText";
import PageHeader from "@/components/quran/PageHeader";
import PageNumber from "@/components/quran/PageNumber";

interface TextPageProps {
  page: number;
  quranTheme: QuranThemeType;
  width: number;
  fontSize: number;
  // When true, render at intrinsic height without the inner ScrollView, so an
  // outer continuous list (VerticalTextReader) owns the scroll. Default paginated
  // mode keeps its own full-screen ScrollView.
  flow?: boolean;
  onAyahLongPress?: (surah: number, ayah: number) => void;
  onSurahLongPress?: (surah: number) => void;
  onWaqfPress?: (signId: string) => void;
  selectedAyah?: { surah: number; ayah: number } | null;
}

const BASMALA =
  "\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0651\u064E\u0647\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0640\u0670\u0646\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650";

const NO_BASMALA_SURAHS = [1, 9];

const TextPage = ({
  page,
  quranTheme,
  width,
  fontSize,
  flow,
  onAyahLongPress,
  onSurahLongPress,
  onWaqfPress,
  selectedAyah,
}: TextPageProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  // Surah-opening ornament frame: TEXT pages have no baked calligraphy, so the
  // localized name renders inside the frame's text-safe panel.
  const currentVersion = useQuranStore((s) => s.currentVersion);
  const surahFrameStyle = useQuranStore((s) =>
    effectiveOrnamentStyle(
      s.ornamentStyle[OrnamentCategory.SURAH_FRAME],
      s.ornamentResolved[OrnamentCategory.SURAH_FRAME]?.[s.currentVersion]
    )
  );
  const surahFrameMeta =
    useQuranStore((s) => s.ornamentMeta[OrnamentCategory.SURAH_FRAME]) ??
    BUNDLED_ORNAMENT_META[OrnamentCategory.SURAH_FRAME];
  const surahFrameAssetMeta = surahFrameMeta.assets[OrnamentAsset.FRAME];
  const surahFrameW = width * 0.92;
  const surahFrameH = surahFrameW / (surahFrameAssetMeta?.aspect ?? 5.968);
  const [ayahs, setAyahs] = useState<AyahTextData[]>([]);
  const [surahName, setSurahName] = useState("");
  const [juz, setJuz] = useState(1);
  const [highlightedAyah, setHighlightedAyah] = useState<{
    surah: number;
    ayah: number;
  } | null>(null);

  const flashAyah = useQuranStore((s) => s.flashAyah);

  // Read-along, mirroring the mushaf exactly: word granularity tints the recited
  // word, verse granularity (and the word-mode fallback for untrackable verses)
  // tints the whole verse. Gated to reader playback, not a Listen/gapless session.
  const readAlong = useQuranStore((s) => s.readAlong);
  const granularity = useQuranStore((s) => s.readAlongGranularity);
  const readAlongWord = useQuranStore((s) => s.readAlongWord);
  const readAlongVerse = useQuranStore((s) => s.readAlongVerse);
  const raSurah = useQuranAudioStore((s) => s.currentSurah);
  const raAyah = useQuranAudioStore((s) => s.currentAyah);
  const raActive = useQuranAudioStore((s) => s.playerState !== QURAN_PLAYER_STATE.IDLE);
  const raQueueKind = useQuranAudioStore((s) => s.queue?.kind);
  const readAlongAyah =
    readAlong && raActive && raQueueKind != null && raQueueKind !== QURAN_QUEUE_KIND.SURAH
      ? { surah: raSurah, ayah: raAyah }
      : null;

  // Resolve, for one verse, whether to tint a single word, the whole verse, or
  // nothing — matching QuranPage's rectangle logic.
  const readAlongFor = (surah: number, ayahNumber: number) => {
    const none = { whole: false, wordIndex: undefined as number | undefined };
    if (!readAlongAyah) return none;
    if (granularity === ReadAlongGranularity.WORD) {
      // The published word may briefly belong to the PREVIOUS ayah — the hook
      // holds the last word lit through the ayah boundary (the reciter's breath).
      if (readAlongWord?.surah === surah && readAlongWord?.ayah === ayahNumber) {
        return { whole: false, wordIndex: readAlongWord.wordIndex };
      }
      if (readAlongAyah.surah === surah && readAlongAyah.ayah === ayahNumber) {
        // No trackable word yet: whole-verse only once we know it's untrackable
        // (divergent/missing timings); otherwise show nothing (still loading).
        return { whole: readAlongVerse, wordIndex: undefined };
      }
      return none;
    }
    if (readAlongAyah.surah !== surah || readAlongAyah.ayah !== ayahNumber) return none;
    return { whole: true, wordIndex: undefined };
  };

  const mutashabihatKeys = useMutashabihatKeys(page);
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
          <Pressable
            key={`surah-header-${surah}`}
            style={styles.surahHeader}
            onLongPress={() => onSurahLongPress?.(surah)}
            delayLongPress={400}
            accessibilityRole="header"
            accessibilityHint={t("a11y.quran.surahInfo")}>
            <View
              style={{ width: surahFrameW, height: surahFrameH }}
              accessibilityRole="header"
              accessibilityLabel={`${t("quran.goto.surah")} ${localizedSurahName(surah)}`}>
              <SurahFrame
                x={0}
                y={0}
                width={surahFrameW}
                height={surahFrameH}
                surahNumber={surah}
                version={currentVersion}
                quranTheme={quranTheme}
                styleId={surahFrameStyle}
                label={`${t("quran.goto.surah")} ${localizedSurahName(surah)}`}
                panel={surahFrameAssetMeta?.panel}
                medallions={surahFrameAssetMeta?.medallions}
                labelColor={themeColors.headerColor}
              />
            </View>
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
          </Pressable>
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
          {group.map((ayah) => {
            const ra = readAlongFor(surah, ayah.ayahNumber);
            return (
              <AyahText
                key={`${surah}-${ayah.ayahNumber}`}
                surahNumber={surah}
                ayahNumber={ayah.ayahNumber}
                text={ayah.text}
                quranTheme={quranTheme}
                isHighlighted={
                  highlightedAyah?.surah === surah && highlightedAyah?.ayah === ayah.ayahNumber
                }
                isReadAlong={ra.whole}
                readAlongWordIndex={ra.wordIndex}
                isFlashing={
                  flashAyah?.surah === surah &&
                  flashAyah?.ayah === ayah.ayahNumber &&
                  !highlightMap.has(`${surah}:${ayah.ayahNumber}`)
                }
                highlightColor={highlightMap.get(`${surah}:${ayah.ayahNumber}`) ?? null}
                bookmarkColor={bookmarkMap.get(`${surah}:${ayah.ayahNumber}`) ?? null}
                hasSimilar={mutashabihatKeys.has(`${surah}:${ayah.ayahNumber}`)}
                onLongPress={handleLongPress}
                onWaqfPress={onWaqfPress}
              />
            );
          })}
        </Text>
      );
    }

    return blocks;
  };

  // Continuous mode: intrinsic height, no inner ScrollView — the outer list
  // scrolls, and each page keeps its header + page number as a visual divider.
  if (flow) {
    return (
      <YStack width={width} style={{ backgroundColor: themeColors.background }}>
        <PageHeader
          surahName={surahName}
          surahNumber={ayahs[0]?.surahNumber ?? null}
          juz={juz}
          quranTheme={quranTheme}
        />
        <View style={[styles.column, styles.flowContent]}>{renderContent()}</View>
        <PageNumber page={page} quranTheme={quranTheme} version={currentVersion} />
      </YStack>
    );
  }

  return (
    <YStack flex={1} width={width} style={{ backgroundColor: themeColors.background }}>
      <PageHeader
        surahName={surahName}
        surahNumber={ayahs[0]?.surahNumber ?? null}
        juz={juz}
        quranTheme={quranTheme}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: 18, paddingBottom: insets.bottom + 48 },
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Cap the reading column so lines stay a comfortable length on wide
            screens; phones (narrower than the cap) are unaffected. */}
        <View style={styles.column}>{renderContent()}</View>
      </ScrollView>

      <PageNumber page={page} quranTheme={quranTheme} version={currentVersion} />
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
  column: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  flowContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
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
