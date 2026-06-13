import { useMemo } from "react";
import { Pressable, ScrollView } from "react-native";
import { View } from "tamagui";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { HighlightColor, QuranTheme } from "@/enums/quran";
import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_ORDER,
  highlightTint,
  QURAN_THEME_COLORS,
} from "@/constants/Quran";
import { useHighlightStore } from "@/stores/quranHighlights";
import { formatNumberToLocale } from "@/utils/number";

interface HighlightLegendProps {
  quranTheme: QuranTheme;
  onPress: () => void;
}

// Legend of the reader's highlight colours: each colour in use shows its
// (renamable) label and how many ayahs carry it, tinted in that colour. Tapping
// a chip opens the highlights list. Renders nothing when no ayah is highlighted.
const HighlightLegend = ({ quranTheme, onPress }: HighlightLegendProps) => {
  const { t } = useTranslation();
  const highlights = useHighlightStore((s) => s.highlights);
  const labels = useHighlightStore((s) => s.labels);
  const themeColors = QURAN_THEME_COLORS[quranTheme];

  const counts = useMemo(() => {
    const map = {} as Record<HighlightColor, number>;
    for (const h of highlights) map[h.color] = (map[h.color] ?? 0) + 1;
    return map;
  }, [highlights]);

  // Most-used colour first; the row scrolls sideways so the bar height is fixed
  // no matter how many colours are in play.
  const used = HIGHLIGHT_COLOR_ORDER.filter((color) => (counts[color] ?? 0) > 0).sort(
    (a, b) => (counts[b] ?? 0) - (counts[a] ?? 0)
  );
  if (!used.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
      {used.map((color) => {
        const solid = HIGHLIGHT_COLORS[color].solid;
        const label = labels[color] ?? t(`quran.highlight.color.${color}`);
        const count = formatNumberToLocale(String(counts[color]));
        return (
          <Pressable
            key={color}
            onPress={onPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${counts[color]}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 5,
              paddingHorizontal: 11,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: solid,
              backgroundColor: highlightTint(color, quranTheme),
            }}>
            <View width={8} height={8} borderRadius={4} backgroundColor={solid} />
            <Text fontSize={11} fontWeight="600" color={themeColors.headerColor}>
              {label} · {count}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

export default HighlightLegend;
