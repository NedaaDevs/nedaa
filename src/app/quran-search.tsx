import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { View, XStack, YStack } from "tamagui";
import { MotiView } from "moti";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { QURAN_FONT_FAMILY, HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_ORDER } from "@/constants/Quran";
import { QuranContentDB, type AyahSearchHit } from "@/services/quran-content-db";
import { localizedSurahName, metadataFontFamily } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";
import { HighlightColor } from "@/enums/quran";
import { useQuranStore } from "@/stores/quran";
import { useHighlightStore } from "@/stores/quranHighlights";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { useRTL } from "@/contexts/RTLContext";
import type { SurahMeta } from "@/types/quran";

type HighlightHit = {
  surah: number;
  ayah: number;
  page: number;
  color: HighlightColor;
  text: string;
};

// Dedicated full-text search, reached by swiping down in the reader (and
// dismissed by swiping up). Matches surah names (transliterated + Arabic) and
// verse text (FTS); the search index + jump are shared with the browse hub.
const QuranSearchScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const chrome = useQuranChromeColors();
  const { isRTL } = useRTL();
  const setCurrentPage = useQuranStore((s) => s.setCurrentPage);

  const [query, setQuery] = useState("");
  const [surahs, setSurahs] = useState<SurahMeta[]>([]);
  const [hits, setHits] = useState<AyahSearchHit[]>([]);
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  useEffect(() => {
    QuranContentDB.getAllSurahs().then(setSurahs);
  }, []);

  // Debounced verse search; an empty query clears results (handled inside the
  // timeout so state isn't set straight from the effect body).
  useEffect(() => {
    const trimmed = query.trim();
    const id = setTimeout(
      () => {
        if (!trimmed) {
          setHits([]);
          return;
        }
        QuranContentDB.searchAyahs(trimmed).then(setHits);
      },
      trimmed ? 200 : 0
    );
    return () => clearTimeout(id);
  }, [query]);

  // Surah-name matches — transliterated ("kahf") or Arabic. Synchronous over the
  // 114-row list, so no debounce needed.
  const q = query.trim().toLowerCase();
  const surahHits = useMemo(() => {
    if (!q) return [];
    return surahs.filter(
      (s) => s.nameTransliterated.toLowerCase().includes(q) || s.nameArabic.includes(query.trim())
    );
  }, [q, query, surahs]);

  // Highlight matches: the query hits a colour's label (renamed or default) or
  // its colour name → surface every ayah marked that colour, with its verse text.
  const highlights = useHighlightStore((s) => s.highlights);
  const labels = useHighlightStore((s) => s.labels);
  const [hlHits, setHlHits] = useState<HighlightHit[]>([]);

  const matchedColors = useMemo(() => {
    const set = new Set<HighlightColor>();
    if (!q) return set;
    for (const color of HIGHLIGHT_COLOR_ORDER) {
      const label = (labels[color] ?? t(`quran.highlight.color.${color}`)).toLowerCase();
      if (label.includes(q) || color.includes(q)) set.add(color);
    }
    return set;
  }, [q, labels, t]);

  const matchedHighlights = useMemo(
    () => highlights.filter((h) => matchedColors.has(h.color)),
    [highlights, matchedColors]
  );

  useEffect(() => {
    let active = true;
    Promise.all(
      matchedHighlights.map(async (h) => {
        const a = await QuranContentDB.getAyah(h.surah, h.ayah);
        return {
          surah: h.surah,
          ayah: h.ayah,
          page: a?.page ?? 1,
          color: h.color,
          text: a?.text ?? "",
        };
      })
    ).then((res) => {
      if (active) setHlHits(res);
    });
    return () => {
      active = false;
    };
  }, [matchedHighlights]);

  const goToPage = (page: number) => {
    setCurrentPage(page);
    router.back();
  };

  const dismiss = useCallback(() => router.back(), [router]);
  // Swipe up on the header dismisses (it was opened by swiping down). Only an
  // upward drag activates, so taps/typing pass through.
  const swipeUpDismiss = useMemo(
    () =>
      Gesture.Pan()
        // Up-only: no activation until the finger moves past -16 on Y (upward).
        .activeOffsetY([-16, 9999])
        .failOffsetX([-24, 24])
        .cancelsTouchesInView(false)
        .onStart(() => scheduleOnRN(dismiss)),
    [dismiss]
  );

  const hasQuery = q.length > 0;
  const empty = hasQuery && hlHits.length === 0 && surahHits.length === 0 && hits.length === 0;

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
      <StatusBar style="auto" />

      <MotiView
        from={{ translateY: -36, opacity: 0 }}
        animate={{ translateY: 0, opacity: 1 }}
        transition={{ type: "timing", duration: 220 }}
        style={{ flex: 1 }}>
        <GestureDetector gesture={swipeUpDismiss}>
          <XStack alignItems="center" gap="$2" paddingHorizontal="$3" paddingVertical="$2">
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t("common.back")}
              hitSlop={8}
              style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
              <BackIcon color={chrome.accent} size={24} />
            </Pressable>

            <XStack
              flex={1}
              alignItems="center"
              gap="$2"
              backgroundColor={chrome.cardBorder}
              borderRadius={12}
              paddingHorizontal="$3"
              height={44}>
              <Search color={chrome.subtleText} size={18} />
              <Input
                flex={1}
                value={query}
                onChangeText={setQuery}
                autoFocus
                placeholder={t("quran.search.placeholder")}
                backgroundColor="transparent"
                borderWidth={0}
                paddingHorizontal={0}
                fontSize={16}
              />
              {query.length > 0 && (
                <Pressable
                  onPress={() => setQuery("")}
                  accessibilityRole="button"
                  accessibilityLabel={t("a11y.clear", { defaultValue: "Clear" })}
                  hitSlop={8}>
                  <X color={chrome.subtleText} size={18} />
                </Pressable>
              )}
            </XStack>
          </XStack>
        </GestureDetector>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          {hasQuery && (
            <>
              {hlHits.length > 0 && (
                <>
                  <SectionLabel chrome={chrome} text={t("quran.library.highlights")} />
                  {hlHits.map((h) => (
                    <HighlightRow
                      key={`h-${h.surah}:${h.ayah}`}
                      chrome={chrome}
                      hit={h}
                      label={labels[h.color] ?? t(`quran.highlight.color.${h.color}`)}
                      onPress={() => goToPage(h.page)}
                    />
                  ))}
                </>
              )}
              {surahHits.length > 0 && (
                <>
                  <SectionLabel chrome={chrome} text={t("quran.browse.surahs")} />
                  {surahHits.map((s) => (
                    <SurahRow
                      key={`s-${s.number}`}
                      chrome={chrome}
                      surah={s}
                      onPress={() => goToPage(s.pageStart)}
                    />
                  ))}
                </>
              )}
              {hits.length > 0 && (
                <>
                  <SectionLabel chrome={chrome} text={t("quran.browse.verses")} />
                  {hits.map((hit) => (
                    <VerseRow
                      key={`v-${hit.surahNumber}:${hit.ayahNumber}`}
                      chrome={chrome}
                      hit={hit}
                      onPress={() => goToPage(hit.page)}
                    />
                  ))}
                </>
              )}
              {empty && (
                <YStack paddingVertical="$10" alignItems="center" gap="$2">
                  <Search color={chrome.subtleText} size={28} />
                  <Text fontSize={14} fontWeight="600" color={chrome.subtleText}>
                    {t("quran.browse.noResults")}
                  </Text>
                </YStack>
              )}
            </>
          )}
        </ScrollView>
      </MotiView>
    </YStack>
  );
};

const SectionLabel = ({
  chrome,
  text,
}: {
  chrome: ReturnType<typeof useQuranChromeColors>;
  text: string;
}) => (
  <Text
    fontSize={13}
    fontWeight="700"
    color={chrome.subtleText}
    paddingTop="$3"
    paddingBottom="$1"
    paddingHorizontal="$1">
    {text}
  </Text>
);

const SurahRow = ({
  chrome,
  surah,
  onPress,
}: {
  chrome: ReturnType<typeof useQuranChromeColors>;
  surah: SurahMeta;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={localizedSurahName(surah.number)}>
    <XStack
      alignItems="center"
      gap="$3"
      paddingVertical="$3"
      borderBottomWidth={1}
      borderColor="$borderColor">
      <YStack
        width={34}
        height={34}
        borderRadius={17}
        alignItems="center"
        justifyContent="center"
        backgroundColor={chrome.cardBorder}>
        <Text fontSize={13} fontWeight="700" color={chrome.text}>
          {formatNumberToLocale(String(surah.number))}
        </Text>
      </YStack>
      <YStack flex={1}>
        <Text
          fontSize={15}
          fontWeight="600"
          color={chrome.text}
          style={{ fontFamily: metadataFontFamily() }}>
          {localizedSurahName(surah.number)}
        </Text>
        <Text fontSize={12} color={chrome.subtleText}>
          {surah.nameTransliterated}
        </Text>
      </YStack>
    </XStack>
  </Pressable>
);

const HighlightRow = ({
  chrome,
  hit,
  label,
  onPress,
}: {
  chrome: ReturnType<typeof useQuranChromeColors>;
  hit: HighlightHit;
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${localizedSurahName(hit.surah)} ${hit.ayah}`}>
    <YStack gap="$1.5" paddingVertical="$3" borderBottomWidth={1} borderColor="$borderColor">
      <XStack alignItems="center" justifyContent="space-between">
        <XStack alignItems="center" gap="$2">
          <View
            width={10}
            height={10}
            borderRadius={5}
            backgroundColor={HIGHLIGHT_COLORS[hit.color].solid}
          />
          <Text
            fontSize={13}
            fontWeight="600"
            color={chrome.text}
            style={{ fontFamily: metadataFontFamily() }}>
            {localizedSurahName(hit.surah)} : {formatNumberToLocale(String(hit.ayah))}
          </Text>
        </XStack>
        <Text fontSize={11} color={chrome.subtleText}>
          {label}
        </Text>
      </XStack>
      <Text
        numberOfLines={2}
        style={{
          fontSize: 18,
          lineHeight: 32,
          writingDirection: "rtl",
          textAlign: "right",
          fontFamily: QURAN_FONT_FAMILY,
          color: chrome.text,
        }}>
        {hit.text}
      </Text>
    </YStack>
  </Pressable>
);

const VerseRow = ({
  chrome,
  hit,
  onPress,
}: {
  chrome: ReturnType<typeof useQuranChromeColors>;
  hit: AyahSearchHit;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${localizedSurahName(hit.surahNumber)} ${hit.ayahNumber}`}>
    <YStack gap="$1.5" paddingVertical="$3" borderBottomWidth={1} borderColor="$borderColor">
      <XStack alignItems="center" justifyContent="space-between">
        <Text
          fontSize={13}
          fontWeight="600"
          color={chrome.text}
          style={{ fontFamily: metadataFontFamily() }}>
          {localizedSurahName(hit.surahNumber)} : {formatNumberToLocale(String(hit.ayahNumber))}
        </Text>
        <Text fontSize={11} color={chrome.subtleText}>
          {formatNumberToLocale(String(hit.page))}
        </Text>
      </XStack>
      <Text
        numberOfLines={2}
        style={{
          fontSize: 18,
          lineHeight: 32,
          writingDirection: "rtl",
          textAlign: "right",
          fontFamily: QURAN_FONT_FAMILY,
          color: chrome.text,
        }}>
        {hit.text}
      </Text>
    </YStack>
  </Pressable>
);

export default QuranSearchScreen;
