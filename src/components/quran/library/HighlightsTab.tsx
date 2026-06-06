import { useMemo, useState } from "react";
import { Pressable, ScrollView } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { HIGHLIGHT_COLORS } from "@/constants/Quran";
import { HighlightColor } from "@/enums/quran";
import { useHighlightStore } from "@/stores/quranHighlights";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import { useRTL } from "@/contexts/RTLContext";
import { localizedSurahName, metadataFontFamily } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";
import { Segmented } from "@/components/quran/settings/SettingsControls";
import { HighlightColors } from "@/app/quran-highlights";

type View = "surah" | "colors";

interface SurahGroup {
  surah: number;
  items: { ayah: number; page: number; color: HighlightColor }[];
}

export const HighlightsTab = ({ onNavigate }: { onNavigate: (page: number) => void }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const chrome = useQuranChromeColors();
  const { isRTL } = useRTL();
  const [view, setView] = useState<View>("surah");
  const highlights = useHighlightStore((s) => s.highlights);
  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const groups = useMemo<SurahGroup[]>(() => {
    const map = new Map<number, SurahGroup["items"]>();
    for (const h of highlights) {
      const list = map.get(h.surah) ?? [];
      list.push({ ayah: h.ayah, page: h.page, color: h.color });
      map.set(h.surah, list);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([surah, items]) => ({ surah, items: items.sort((a, b) => a.ayah - b.ayah) }));
  }, [highlights]);

  return (
    <YStack flex={1}>
      <YStack paddingHorizontal="$3" paddingVertical="$2">
        <Segmented
          chrome={chrome}
          compact
          selected={view}
          onSelect={setView}
          options={[
            { value: "surah", label: t("quran.browse.surahs") },
            { value: "colors", label: t("quran.highlight.colorsTab") },
          ]}
        />
      </YStack>

      {view === "colors" ? (
        <HighlightColors />
      ) : groups.length === 0 ? (
        <YStack paddingVertical="$10" alignItems="center">
          <Text fontSize={14} fontWeight="600" color={chrome.subtleText}>
            {t("quran.highlight.emptyList")}
          </Text>
        </YStack>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 24 }}>
          {groups.map((g) => (
            <YStack key={g.surah} paddingBottom="$3">
              <Text
                fontSize={15}
                fontWeight="700"
                color={chrome.text}
                paddingVertical="$2"
                style={{ fontFamily: metadataFontFamily() }}>
                {localizedSurahName(g.surah)}
              </Text>
              {g.items.map((it) => (
                <Pressable
                  key={`${g.surah}:${it.ayah}`}
                  onPress={() => onNavigate(it.page)}
                  accessibilityRole="button"
                  accessibilityLabel={t("a11y.quran.ayahText", { surah: g.surah, ayah: it.ayah })}>
                  <XStack
                    alignItems="center"
                    gap="$3"
                    paddingVertical="$3"
                    paddingHorizontal="$2"
                    borderBottomWidth={1}
                    borderBottomColor="$borderColor">
                    <YStack
                      width={14}
                      height={14}
                      borderRadius={7}
                      backgroundColor={HIGHLIGHT_COLORS[it.color].solid}
                    />
                    <Text flex={1} fontSize={14} color={chrome.text}>
                      {`${localizedSurahName(g.surah)} ${formatNumberToLocale(String(it.ayah))}`}
                    </Text>
                    <Chevron color={chrome.subtleText} size={18} />
                  </XStack>
                </Pressable>
              ))}
            </YStack>
          ))}
        </ScrollView>
      )}
    </YStack>
  );
};
