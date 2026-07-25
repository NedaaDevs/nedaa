import { useColorScheme } from "react-native";
import { XStack } from "tamagui";
import { useTranslation } from "react-i18next";

import { QuranTheme, QuranThemeType } from "@/enums/quran";
import { useQuranStore } from "@/stores/quran";
import { useAppStore } from "@/stores/app";
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
  const quranTheme = useQuranStore((s) => s.quranTheme);
  const override = useQuranStore((s) => s.quranThemeOverride);
  const setQuranTheme = useQuranStore((s) => s.setQuranTheme);
  const setQuranThemeAuto = useQuranStore((s) => s.setQuranThemeAuto);

  const mode = useAppStore((s) => s.mode);
  const systemScheme = useColorScheme();
  const appIsDark = mode === "system" ? systemScheme === "dark" : mode === "dark";
  const nedaaPreview = appIsDark ? QuranTheme.NEDAA_DARK : QuranTheme.NEDAA_LIGHT;

  return (
    <XStack
      columnGap="$2"
      accessibilityRole="radiogroup"
      accessibilityLabel={t("quran.settings.readingTheme")}>
      <ThemePreviewCard
        theme={nedaaPreview}
        label={t("quran.settings.themeNedaa")}
        badge={t("quran.settings.themeAuto")}
        selected={!override}
        onPress={setQuranThemeAuto}
        compact
      />
      {EXPLICIT.map((e) => (
        <ThemePreviewCard
          key={e.theme}
          theme={e.theme}
          label={t(e.labelKey)}
          selected={override && quranTheme === e.theme}
          onPress={() => setQuranTheme(e.theme)}
          compact
        />
      ))}
    </XStack>
  );
};

export default ReadingThemeSwatches;
