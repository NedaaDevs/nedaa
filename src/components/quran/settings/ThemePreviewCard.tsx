import { Pressable } from "react-native";
import { View, XStack, YStack } from "tamagui";

import { Text } from "@/components/ui/text";
import { QuranThemeType } from "@/enums/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";

// Ink-line widths (%) for the mini page; the 2nd line carries an ayah marker.
const LINES = [90, 74, 84, 66];

interface ThemePreviewCardProps {
  // The theme whose colours render the preview (for Nedaa: the resolved variant).
  theme: QuranThemeType;
  label: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}

// A tappable card showing a miniature mushaf page in the theme's real colours —
// paper background, ink lines, an ayah-marker dot — so the picker shows what you
// get rather than an abstract swatch.
const ThemePreviewCard = ({ theme, label, badge, selected, onPress }: ThemePreviewCardProps) => {
  const c = QURAN_THEME_COLORS[theme];
  const chrome = useQuranChromeColors();
  const ink = c.textTint ?? c.headerColor;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{ width: "47%" }}>
      <YStack gap="$1.5">
        <YStack
          height={88}
          borderRadius={12}
          borderWidth={2}
          borderColor={selected ? chrome.accent : chrome.cardBorder}
          backgroundColor={c.background}
          paddingHorizontal="$3"
          justifyContent="center"
          gap="$2"
          overflow="hidden">
          {LINES.map((w, i) => (
            <XStack key={i} alignItems="center" justifyContent="flex-end" gap={5}>
              {i === 1 && (
                <View width={9} height={9} borderRadius={5} backgroundColor={c.markerColor} />
              )}
              <View
                height={4}
                borderRadius={2}
                width={`${w}%`}
                backgroundColor={ink}
                opacity={0.78}
              />
            </XStack>
          ))}
        </YStack>
        <XStack alignItems="center" gap="$1.5">
          <Text fontSize={13} fontWeight="600" color={selected ? chrome.accent : chrome.text}>
            {label}
          </Text>
          {badge ? (
            <Text
              fontSize={10}
              fontWeight="700"
              color={chrome.subtleText}
              textTransform="uppercase">
              {badge}
            </Text>
          ) : null}
        </XStack>
      </YStack>
    </Pressable>
  );
};

export default ThemePreviewCard;
