import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams } from "expo-router";

import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { MushafVersion } from "@/enums/quran";
import { QuranContentDB } from "@/services/quran-content-db";
import { useQuranStore } from "@/stores/quran";
import { useResolvedQuranTheme } from "@/hooks/useResolvedQuranTheme";
import { localizedSurahName } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";
import { GuideEntryCard } from "@/components/quran/library/GuideEntryCard";
import { ReaderContentPage } from "@/components/quran/ReaderContentPage";
import { buildTajweedCards } from "@/components/quran/tajweed-cards";

// Full page: the tajweed rules present in one ayah (V4 edition), each as a card
// with the edition's colour swatch and the rule name. Reached from the ayah sheet.
const QuranTajweedScreen = () => {
  const { t, i18n } = useTranslation();
  const { surah, ayah } = useLocalSearchParams<{ surah: string; ayah: string }>();
  const surahNum = Number(surah);
  const ayahNum = Number(ayah);
  const version = useQuranStore((s) => s.currentVersion);
  const quranTheme = useResolvedQuranTheme();
  const c = QURAN_THEME_COLORS[quranTheme];
  const ink = c.textTint ?? c.headerColor;
  const isArabicLocale = i18n.language === "ar";
  const isLatinLocale = i18n.language === "en" || i18n.language === "ms";

  const [tajweed, setTajweed] = useState<{ index: number; hex: string }[]>([]);
  useEffect(() => {
    if (!surahNum || !ayahNum || version !== MushafVersion.V4) return;
    let cancelled = false;
    QuranContentDB.getAyahTajweed(version, surahNum, ayahNum).then((r) => {
      if (!cancelled) setTajweed(r);
    });
    return () => {
      cancelled = true;
    };
  }, [surahNum, ayahNum, version]);

  const cards = buildTajweedCards(tajweed, t);
  const colors = {
    text: ink,
    subtleText: c.pageNumberColor,
    cardBg: c.innerBackground,
    cardBorder: c.frameColor,
  };
  const subtitle = surahNum
    ? `${localizedSurahName(surahNum)} · ${formatNumberToLocale(String(ayahNum))}`
    : undefined;

  return (
    <ReaderContentPage title={t("quran.tajweed.title")} subtitle={subtitle}>
      {cards.map((card) => (
        <GuideEntryCard
          key={card.key}
          entry={card.entry}
          colors={colors}
          title={card.title}
          body={card.body}
          isArabic={isArabicLocale}
          isLatin={isLatinLocale}
        />
      ))}
    </ReaderContentPage>
  );
};

export default QuranTajweedScreen;
