import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView } from "react-native";
import { XStack, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Search, X } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { Input } from "@/components/ui/input";
import { TOTAL_PAGES, QURAN_FONT_FAMILY } from "@/constants/Quran";
import { QuranContentDB, type AyahSearchHit } from "@/services/quran-content-db";
import { localizedSurahName, metadataFontFamily } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";
import { juzLabel } from "@/utils/juz";
import { useQuranStore } from "@/stores/quran";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { useRTL } from "@/contexts/RTLContext";
import { RevelationPlace } from "@/enums/quran";
import { Segmented } from "@/components/quran/settings/SettingsControls";
import type { SurahMeta } from "@/types/quran";

type BrowseTab = "surah" | "juz" | "hizb" | "page";

// Full-page browse + search: surah / juz / hizb / page navigation plus general
// search (surah names + verse full-text via FTS). Embeddable content (no frame)
// so it can be a standalone route and a tab inside the Library hub.
export const BrowseIndex = ({
  onNavigate,
  initialTab = "surah",
}: {
  onNavigate: (page: number) => void;
  initialTab?: BrowseTab;
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const chrome = useQuranChromeColors();
  const { isRTL } = useRTL();

  const [tab, setTab] = useState<BrowseTab>(initialTab);
  const [query, setQuery] = useState("");
  const [surahs, setSurahs] = useState<SurahMeta[]>([]);
  const [juz, setJuz] = useState<{ division: number; page: number }[]>([]);
  const [hizb, setHizb] = useState<{ division: number; page: number }[]>([]);
  const [pageInput, setPageInput] = useState("");
  const [verseHits, setVerseHits] = useState<AyahSearchHit[]>([]);

  useEffect(() => {
    QuranContentDB.getAllSurahs().then(setSurahs);
    QuranContentDB.getJuzStartPages().then(setJuz);
    QuranContentDB.getHizbStartPages().then(setHizb);
  }, []);

  // Debounced verse full-text search; cleared when the query empties.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVerseHits([]);
      return;
    }
    let active = true;
    const handle = setTimeout(() => {
      QuranContentDB.searchAyahs(trimmed).then((hits) => {
        if (active) setVerseHits(hits);
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query]);

  const go = onNavigate;

  const submitPage = () => {
    const n = parseInt(pageInput, 10);
    if (Number.isFinite(n)) go(Math.max(1, Math.min(TOTAL_PAGES, n)));
  };

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    return surahs.filter(
      (s) =>
        s.nameTransliterated.toLowerCase().includes(q) ||
        s.nameArabic.includes(query.trim()) ||
        String(s.number) === q
    );
  }, [q, query, surahs]);

  // The surah a division (juz/hizb) opens into — the last surah starting at or
  // before its page — for the "Begins {surah} · page N" subtitle.
  const surahAtPage = (page: number) =>
    surahs.filter((s) => s.pageStart <= page).slice(-1)[0] ?? surahs[0];
  const divisionSubtitle = (page: number) => {
    const s = surahAtPage(page);
    return s
      ? t("quran.browse.beginsAt", {
          surah: localizedSurahName(s.number),
          page: formatNumberToLocale(String(page)),
        })
      : "";
  };

  return (
    <YStack flex={1}>
      {/* Search */}
      <XStack alignItems="center" gap="$2" paddingHorizontal="$3" paddingVertical="$2">
        <XStack
          flex={1}
          alignItems="center"
          gap="$2"
          backgroundColor="$backgroundSecondary"
          borderWidth={1}
          borderColor="$borderColor"
          borderRadius="$4"
          paddingHorizontal="$3"
          height={44}>
          <Search color={chrome.subtleText} size={18} />
          <Input
            flex={1}
            value={query}
            onChangeText={setQuery}
            placeholder={t("quran.browse.searchPlaceholder")}
            borderWidth={0}
            backgroundColor="transparent"
            paddingHorizontal="$0"
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery("")}
              accessibilityRole="button"
              accessibilityLabel={t("common.clear")}
              hitSlop={8}>
              <X color={chrome.subtleText} size={16} />
            </Pressable>
          )}
        </XStack>
      </XStack>

      {!q && (
        <YStack paddingHorizontal="$3" paddingBottom="$2" gap="$2">
          <Segmented
            chrome={chrome}
            compact
            selected={tab}
            onSelect={setTab}
            options={[
              { value: "surah", label: t("quran.goto.surah") },
              { value: "juz", label: t("quran.goto.juz") },
              { value: "hizb", label: t("quran.goto.hizb") },
              { value: "page", label: t("quran.goto.page") },
            ]}
          />
          {tab === "page" && (
            <XStack gap="$2" alignItems="center">
              <Input
                flex={1}
                value={pageInput}
                onChangeText={setPageInput}
                onSubmitEditing={submitPage}
                keyboardType="number-pad"
                returnKeyType="go"
                placeholder={t("quran.goto.pagePrompt", {
                  from: formatNumberToLocale("1"),
                  total: formatNumberToLocale(String(TOTAL_PAGES)),
                })}
              />
              <Pressable
                onPress={submitPage}
                accessibilityRole="button"
                accessibilityLabel={t("quran.goto.go")}>
                <YStack
                  backgroundColor={chrome.accent}
                  paddingHorizontal="$4"
                  height={44}
                  borderRadius="$3"
                  alignItems="center"
                  justifyContent="center">
                  <Text color="#fff" fontWeight="700" fontSize={15}>
                    {t("quran.goto.go")}
                  </Text>
                </YStack>
              </Pressable>
            </XStack>
          )}
        </YStack>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {q ? (
          <>
            {results.length > 0 && (
              <>
                <SectionLabel
                  chrome={chrome}
                  text={t("quran.browse.surahs")}
                  count={results.length}
                />
                {results.map((s) => (
                  <SurahRow
                    key={`s-${s.number}`}
                    chrome={chrome}
                    surah={s}
                    onPress={() => go(s.pageStart)}
                    t={t}
                  />
                ))}
              </>
            )}
            {verseHits.length > 0 && (
              <>
                <SectionLabel
                  chrome={chrome}
                  text={t("quran.browse.verses")}
                  count={verseHits.length}
                />
                {verseHits.map((h) => (
                  <VerseRow
                    key={`v-${h.surahNumber}:${h.ayahNumber}`}
                    chrome={chrome}
                    hit={h}
                    onPress={() => go(h.page)}
                  />
                ))}
              </>
            )}
            {results.length === 0 && verseHits.length === 0 && (
              <YStack paddingVertical="$10" alignItems="center" gap="$2">
                <Search color={chrome.subtleText} size={28} />
                <Text fontSize={14} fontWeight="600" color={chrome.subtleText}>
                  {t("quran.browse.noResults")}
                </Text>
              </YStack>
            )}
          </>
        ) : (
          <>
            {tab === "surah" &&
              surahs.map((s) => (
                <SurahRow
                  key={s.number}
                  chrome={chrome}
                  surah={s}
                  onPress={() => go(s.pageStart)}
                  t={t}
                />
              ))}
            {tab === "juz" &&
              juz.map((j) => (
                <DivisionRow
                  key={j.division}
                  chrome={chrome}
                  isRTL={isRTL}
                  leading={j.division}
                  title={juzLabel(j.division)}
                  subtitle={divisionSubtitle(j.page)}
                  onPress={() => go(j.page)}
                />
              ))}
            {tab === "hizb" &&
              hizb.map((h) => (
                <DivisionRow
                  key={h.division}
                  chrome={chrome}
                  isRTL={isRTL}
                  leading={h.division}
                  title={t("quran.goto.hizbLabel", {
                    n: formatNumberToLocale(String(h.division)),
                  })}
                  subtitle={divisionSubtitle(h.page)}
                  onPress={() => go(h.page)}
                />
              ))}
          </>
        )}
      </ScrollView>
    </YStack>
  );
};

const SectionLabel = ({
  chrome,
  text,
  count,
}: {
  chrome: ReturnType<typeof useQuranChromeColors>;
  text: string;
  count: number;
}) => (
  <Text
    fontSize={13}
    fontWeight="700"
    color={chrome.text}
    paddingTop="$3"
    paddingBottom="$1"
    paddingHorizontal="$1">
    {text} ({formatNumberToLocale(String(count))})
  </Text>
);

const SurahRow = ({
  chrome,
  surah,
  onPress,
  t,
}: {
  chrome: ReturnType<typeof useQuranChromeColors>;
  surah: SurahMeta;
  onPress: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) => {
  const place =
    surah.revelationPlace === RevelationPlace.MAKKAH
      ? t("quran.surah.makki")
      : t("quran.surah.madani");
  return (
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
          backgroundColor="$backgroundSecondary"
          alignItems="center"
          justifyContent="center">
          <Text fontSize={13} fontWeight="700" color={chrome.accent}>
            {formatNumberToLocale(String(surah.number))}
          </Text>
        </YStack>
        <YStack flex={1} gap="$1">
          <Text
            fontSize={16}
            fontWeight="700"
            color={chrome.text}
            style={{ fontFamily: metadataFontFamily() }}>
            {localizedSurahName(surah.number)}
          </Text>
          <Text fontSize={12} color={chrome.subtleText}>
            {t("quran.goto.page")} {formatNumberToLocale(String(surah.pageStart))} ·{" "}
            {t("quran.surah.ayahCount", { n: formatNumberToLocale(String(surah.ayahCount)) })} ·{" "}
            {place}
          </Text>
        </YStack>
      </XStack>
    </Pressable>
  );
};

const DivisionRow = ({
  chrome,
  isRTL,
  leading,
  title,
  subtitle,
  onPress,
}: {
  chrome: ReturnType<typeof useQuranChromeColors>;
  isRTL: boolean;
  leading: number;
  title: string;
  subtitle: string;
  onPress: () => void;
}) => {
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title} · ${subtitle}`}>
      <XStack
        alignItems="center"
        gap="$3"
        padding="$3"
        marginBottom="$2"
        borderWidth={1}
        borderColor="$borderColor"
        borderRadius={14}
        backgroundColor="$backgroundSecondary">
        <YStack
          width={40}
          height={40}
          borderRadius={12}
          alignItems="center"
          justifyContent="center"
          style={{ backgroundColor: `${chrome.accent}14` }}>
          <Text fontSize={15} fontWeight="700" color={chrome.accent}>
            {formatNumberToLocale(String(leading))}
          </Text>
        </YStack>
        <YStack flex={1} gap="$1">
          <Text
            fontSize={15}
            fontWeight="600"
            color={chrome.text}
            style={{ fontFamily: metadataFontFamily() }}>
            {title}
          </Text>
          <Text fontSize={12} color={chrome.subtleText}>
            {subtitle}
          </Text>
        </YStack>
        <Chevron color={chrome.subtleText} size={18} />
      </XStack>
    </Pressable>
  );
};

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

// Standalone route wrapper — frames BrowseIndex with a back header.
const QuranBrowseScreen = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const chrome = useQuranChromeColors();
  const { isRTL } = useRTL();
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab: BrowseTab = (["surah", "juz", "hizb", "page"] as const).includes(
    params.tab as BrowseTab
  )
    ? (params.tab as BrowseTab)
    : "surah";
  const setCurrentPage = useQuranStore((s) => s.setCurrentPage);
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  return (
    <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
      <StatusBar style="auto" />
      <XStack alignItems="center" paddingHorizontal="$3" paddingVertical="$2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          hitSlop={8}
          style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <BackIcon color={chrome.accent} size={24} />
        </Pressable>
      </XStack>
      <BrowseIndex
        initialTab={initialTab}
        onNavigate={(page) => {
          setCurrentPage(page);
          router.back();
        }}
      />
    </YStack>
  );
};

export default QuranBrowseScreen;
