import { useColorScheme } from "react-native";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { QuranTheme, QuranThemeType } from "@/enums/quran";
import { useQuranStore } from "@/stores/quran";
import { useAppStore } from "@/stores/app";
import { useQuranChromeColors } from "@/hooks/useQuranChromeColors";
import ThemePreviewCard from "@/components/quran/settings/ThemePreviewCard";

// Explicit reader papers (override). Nedaa is handled separately as the
// no-override default that follows the app scheme.
const EXPLICIT: { theme: QuranThemeType; labelKey: string }[] = [
  { theme: QuranTheme.LIGHT, labelKey: "quran.settings.themeLight" },
  { theme: QuranTheme.DARK, labelKey: "quran.settings.themeDark" },
  { theme: QuranTheme.SEPIA, labelKey: "quran.settings.themeSepia" },
];

const ReadingThemeSwatches = () => {
  const { t } = useTranslation();
  const chrome = useQuranChromeColors();
  const quranTheme = useQuranStore((s) => s.quranTheme);
  const override = useQuranStore((s) => s.quranThemeOverride);
  const setQuranTheme = useQuranStore((s) => s.setQuranTheme);
  const setQuranThemeAuto = useQuranStore((s) => s.setQuranThemeAuto);

  const mode = useAppStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const appIsDark = mode === "system" ? systemScheme === "dark" : mode === "dark";
  const nedaaPreview = appIsDark ? QuranTheme.NEDAA_DARK : QuranTheme.NEDAA_LIGHT;

  return (
    <YStack gap="$2.5">
      <Text fontSize={13} fontWeight="700" color={chrome.subtleText}>
        {t("quran.settings.readingTheme")}
      </Text>
      <XStack flexWrap="wrap" columnGap="$3" rowGap="$3" justifyContent="space-between">
        <ThemePreviewCard
          theme={nedaaPreview}
          label={t("quran.settings.themeNedaa")}
          badge={t("quran.settings.themeAuto")}
          selected={!override}
          onPress={setQuranThemeAuto}
        />
        {EXPLICIT.map((e) => (
          <ThemePreviewCard
            key={e.theme}
            theme={e.theme}
            label={t(e.labelKey)}
            selected={override && quranTheme === e.theme}
            onPress={() => setQuranTheme(e.theme)}
          />
        ))}
      </XStack>
      <Text fontSize={12} color={chrome.subtleText} lineHeight={17} marginTop="$1">
        {t("quran.settings.themeNote")}
      </Text>
    </YStack>
  );
};

export default ReadingThemeSwatches;
