import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { HIGHLIGHT_COLORS, HIGHLIGHT_COLOR_ORDER, QURAN_TEXT_FONT } from "@/constants/Quran";
import { HighlightColor } from "@/enums/quran";
import { useHighlightStore } from "@/stores/quranHighlights";
import { useQuranStore } from "@/stores/quran";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { usePreviewQuranTheme } from "@/hooks/useResolvedQuranTheme";
import { useRTL } from "@/contexts/RTLContext";
import { QuranContentDB } from "@/services/quran-content-db";
import { localizedSurahName, metadataFontFamily } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";
import { Segmented } from "@/components/quran/settings/SettingsControls";
import AyahImage from "@/components/quran/AyahImage";

type View = "colors" | "surah";

interface HlItem {
  surah: number;
  ayah: number;
  page: number;
  color: HighlightColor;
}
interface Group {
  key: string;
  title: string;
  color?: HighlightColor;
  items: HlItem[];
}

const sortItems = (a: HlItem, b: HlItem) => a.surah - b.surah || a.ayah - b.ayah;

export const HighlightsTab = ({ onNavigate }: { onNavigate: (page: number) => void }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const chrome = useQuranChromeColors();
  const previewTheme = usePreviewQuranTheme();
  const { isRTL } = useRTL();
  const version = useQuranStore((s) => s.currentVersion);
  const highlights = useHighlightStore((s) => s.highlights);
  const labels = useHighlightStore((s) => s.labels);

  const [view, setView] = useState<View>("colors");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [texts, setTexts] = useState<Map<string, string>>(new Map());

  // Load each highlighted verse's text for the cards.
  useEffect(() => {
    let active = true;
    Promise.all(
      highlights.map((h) =>
        QuranContentDB.getAyah(h.surah, h.ayah).then(
          (d) => [`${h.surah}:${h.ayah}`, d?.text ?? ""] as const
        )
      )
    ).then((entries) => {
      if (active) setTexts(new Map(entries));
    });
    return () => {
      active = false;
    };
  }, [highlights]);

  const groups = useMemo<Group[]>(() => {
    if (view === "colors") {
      return HIGHLIGHT_COLOR_ORDER.map((color) => ({
        key: `c:${color}`,
        title: labels[color] ?? t(`quran.highlight.color.${color}`),
        color,
        items: highlights.filter((h) => h.color === color).sort(sortItems),
      })).filter((g) => g.items.length > 0);
    }
    const bySurah = new Map<number, HlItem[]>();
    for (const h of highlights) {
      const list = bySurah.get(h.surah) ?? [];
      list.push(h);
      bySurah.set(h.surah, list);
    }
    return [...bySurah.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([surah, items]) => ({
        key: `s:${surah}`,
        title: localizedSurahName(surah),
        items: items.sort(sortItems),
      }));
  }, [view, highlights, labels, t]);

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const CollapsedChevron = isRTL ? ChevronLeft : ChevronRight;

  return (
    <YStack flex={1}>
      <YStack paddingHorizontal="$3" paddingVertical="$2">
        <Segmented
          chrome={chrome}
          compact
          selected={view}
          onSelect={setView}
          options={[
            { value: "colors", label: t("quran.highlight.colorsTab") },
            { value: "surah", label: t("quran.browse.surahs") },
          ]}
        />
      </YStack>

      {groups.length === 0 ? (
        <YStack paddingVertical="$10" alignItems="center">
          <Text fontSize={14} fontWeight="600" color={chrome.subtleText}>
            {t("quran.highlight.emptyList")}
          </Text>
        </YStack>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}>
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.key);
            return (
              <YStack key={g.key} paddingBottom="$3">
                {/* Group header — tap to collapse/expand */}
                <Pressable
                  onPress={() => toggle(g.key)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: !isCollapsed }}
                  accessibilityLabel={g.title}>
                  <XStack alignItems="center" gap="$2" paddingVertical="$2" paddingHorizontal="$1">
                    {g.color && (
                      <YStack
                        width={12}
                        height={12}
                        borderRadius={6}
                        backgroundColor={HIGHLIGHT_COLORS[g.color].solid}
                      />
                    )}
                    <Text
                      fontSize={16}
                      fontWeight="700"
                      color={chrome.text}
                      style={{ fontFamily: metadataFontFamily() }}>
                      {g.title}
                    </Text>
                    <Text fontSize={12} color={chrome.subtleText}>
                      {formatNumberToLocale(String(g.items.length))}
                    </Text>
                    <YStack flex={1} />
                    {isCollapsed ? (
                      <CollapsedChevron color={chrome.accent} size={20} />
                    ) : (
                      <ChevronDown color={chrome.accent} size={20} />
                    )}
                  </XStack>
                </Pressable>

                {!isCollapsed &&
                  g.items.map((it) => (
                    <Pressable
                      key={`${it.surah}:${it.ayah}`}
                      onPress={() => onNavigate(it.page)}
                      accessibilityRole="button"
                      accessibilityLabel={t("a11y.quran.ayahText", {
                        surah: it.surah,
                        ayah: it.ayah,
                      })}>
                      <YStack
                        backgroundColor="$backgroundSecondary"
                        borderRadius={14}
                        borderWidth={1}
                        borderColor="$borderColor"
                        padding="$3"
                        marginBottom="$2"
                        gap="$2">
                        <AyahImage
                          version={version}
                          page={it.page}
                          surah={it.surah}
                          ayah={it.ayah}
                          quranTheme={previewTheme}
                          maxWidth={width - 80}
                          fallback={
                            <Text
                              style={{
                                fontSize: 19,
                                lineHeight: 38,
                                writingDirection: "rtl",
                                textAlign: "center",
                                fontFamily: QURAN_TEXT_FONT,
                                color: chrome.text,
                              }}>
                              {texts.get(`${it.surah}:${it.ayah}`) ?? ""}
                            </Text>
                          }
                        />
                        <XStack alignItems="center" gap="$2">
                          <YStack
                            width={10}
                            height={10}
                            borderRadius={5}
                            backgroundColor={HIGHLIGHT_COLORS[it.color].solid}
                          />
                          <Text fontSize={12} color={chrome.subtleText}>
                            {`${localizedSurahName(it.surah)}: ${formatNumberToLocale(String(it.ayah))}`}
                          </Text>
                        </XStack>
                      </YStack>
                    </Pressable>
                  ))}
              </YStack>
            );
          })}
        </ScrollView>
      )}
    </YStack>
  );
};
