import { Pressable } from "react-native";
import { View, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import { useQuranChromeColors, type QuranChromeColors } from "@/hooks/useQuranChromeColors";

// "auto" follows the app's color scheme; the rest pick a specific reader paper.
type SwatchKey = QuranTheme | "auto";

const SWATCHES: { theme: SwatchKey; bg: `#${string}`; labelKey: string }[] = [
  {
    theme: "auto",
    bg: QURAN_THEME_COLORS[QuranTheme.SEPIA].background,
    labelKey: "quran.settings.themeAuto",
  },
  {
    theme: QuranTheme.SEPIA,
    bg: QURAN_THEME_COLORS[QuranTheme.SEPIA].background,
    labelKey: "quran.settings.themeSepia",
  },
  {
    theme: QuranTheme.LIGHT,
    bg: QURAN_THEME_COLORS[QuranTheme.LIGHT].background,
    labelKey: "quran.settings.themeLight",
  },
  {
    theme: QuranTheme.DARK,
    bg: QURAN_THEME_COLORS[QuranTheme.DARK].background,
    labelKey: "quran.settings.themeDark",
  },
  {
    theme: QuranTheme.AMOLED,
    bg: QURAN_THEME_COLORS[QuranTheme.AMOLED].background,
    labelKey: "quran.settings.themeAmoled",
  },
];

const ReadingThemeSwatches = () => {
  const { t } = useTranslation();
  const chrome = useQuranChromeColors();
  const quranTheme = useQuranStore((s) => s.quranTheme);
  const override = useQuranStore((s) => s.quranThemeOverride);
  const setQuranTheme = useQuranStore((s) => s.setQuranTheme);
  const setQuranThemeAuto = useQuranStore((s) => s.setQuranThemeAuto);

  // Auto is active when the user hasn't overridden the theme.
  const active = (theme: SwatchKey) =>
    theme === "auto" ? !override : override && quranTheme === theme;

  return (
    <YStack gap="$2">
      <Text fontSize={13} fontWeight="700" color={chrome.subtleText}>
        {t("quran.settings.readingTheme")}
      </Text>
      <XStack gap="$3" flexWrap="wrap">
        {SWATCHES.map((s) => (
          <Swatch
            key={String(s.theme)}
            bg={s.bg}
            label={t(s.labelKey)}
            active={active(s.theme)}
            chrome={chrome}
            onPress={() => {
              if (s.theme === "auto") setQuranThemeAuto();
              else setQuranTheme(s.theme);
            }}
          />
        ))}
      </XStack>
      <Text fontSize={12} color={chrome.subtleText} lineHeight={17} marginTop="$2">
        {t("quran.settings.themeNote")}
      </Text>
    </YStack>
  );
};

const Swatch = ({
  bg,
  label,
  active,
  chrome,
  onPress,
}: {
  bg: `#${string}`;
  label: string;
  active: boolean;
  chrome: QuranChromeColors;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityState={{ selected: active }}
    accessibilityLabel={label}>
    <YStack alignItems="center" gap="$1">
      <View
        width={48}
        height={48}
        borderRadius={12}
        backgroundColor={bg}
        borderWidth={2}
        borderColor={active ? chrome.accent : chrome.cardBorder}
        alignItems="center"
        justifyContent="center">
        {active && <Check size={18} color={chrome.accent} />}
      </View>
      <Text fontSize={11} fontWeight="600" color={active ? chrome.accent : chrome.subtleText}>
        {label}
      </Text>
    </YStack>
  </Pressable>
);

export default ReadingThemeSwatches;
