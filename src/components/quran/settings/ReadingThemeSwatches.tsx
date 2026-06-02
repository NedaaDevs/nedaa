import { Pressable } from "react-native";
import { View, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { QuranTheme } from "@/enums/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import { useQuranChromeColors, type QuranChromeColors } from "@/hooks/useQuranChromeColors";

// `light` and `amoled` are shown as "Soon" until those reader papers exist
// (the QuranTheme enum is SEPIA/DARK today).
type SwatchKey = QuranTheme | "auto" | "light" | "amoled";

const SWATCHES: { theme: SwatchKey; bg: `#${string}`; soon?: boolean }[] = [
  { theme: "auto", bg: QURAN_THEME_COLORS[QuranTheme.SEPIA].background as `#${string}` },
  { theme: QuranTheme.SEPIA, bg: QURAN_THEME_COLORS[QuranTheme.SEPIA].background as `#${string}` },
  { theme: QuranTheme.DARK, bg: QURAN_THEME_COLORS[QuranTheme.DARK].background as `#${string}` },
  { theme: "light", bg: "#FFFDF7", soon: true },
  { theme: "amoled", bg: "#000000", soon: true },
];

const ReadingThemeSwatches = () => {
  const { t } = useTranslation();
  const chrome = useQuranChromeColors();
  const quranTheme = useQuranStore((s) => s.quranTheme);
  const override = useQuranStore((s) => s.quranThemeOverride);
  const setQuranTheme = useQuranStore((s) => s.setQuranTheme);
  const setQuranThemeAuto = useQuranStore((s) => s.setQuranThemeAuto);

  const label = (theme: SwatchKey) =>
    theme === "auto"
      ? t("quran.settings.themeAuto")
      : theme === QuranTheme.SEPIA
        ? t("quran.settings.themeSepia")
        : theme === QuranTheme.DARK
          ? t("quran.settings.themeDark")
          : theme === "light"
            ? t("quran.settings.themeLight")
            : t("quran.settings.themeAmoled");

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
            label={label(s.theme)}
            active={active(s.theme)}
            soon={s.soon}
            soonLabel={t("quran.settings.soon")}
            chrome={chrome}
            onPress={() => {
              if (s.soon) return;
              if (s.theme === "auto") setQuranThemeAuto();
              else setQuranTheme(s.theme as QuranTheme);
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
  soon,
  soonLabel,
  chrome,
  onPress,
}: {
  bg: `#${string}`;
  label: string;
  active: boolean;
  soon?: boolean;
  soonLabel: string;
  chrome: QuranChromeColors;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    disabled={soon}
    accessibilityRole="radio"
    accessibilityState={{ selected: active, disabled: soon }}
    accessibilityLabel={`${label}${soon ? ` (${soonLabel})` : ""}`}>
    <YStack alignItems="center" gap="$1" opacity={soon ? 0.45 : 1}>
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
        {soon ? soonLabel : label}
      </Text>
    </YStack>
  </Pressable>
);

export default ReadingThemeSwatches;
