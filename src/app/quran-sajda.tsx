import { useTranslation } from "react-i18next";

import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { guideEntriesByCategory } from "@/services/guide-content";
import { GuideCategory, guideTextKey } from "@/types/guide";
import { useResolvedQuranTheme } from "@/hooks/useResolvedQuranTheme";
import { GuideEntryCard } from "@/components/quran/library/GuideEntryCard";
import { ReaderContentPage } from "@/components/quran/ReaderContentPage";

// Full page: the sajdah (prostration) reference — the dua to recite and its
// explanation, reached from a sajdah ayah's action sheet.
const QuranSajdaScreen = () => {
  const { t, i18n } = useTranslation();
  const quranTheme = useResolvedQuranTheme();
  const c = QURAN_THEME_COLORS[quranTheme];
  const ink = c.textTint ?? c.headerColor;
  const isArabicLocale = i18n.language === "ar";
  const isLatinLocale = i18n.language === "en" || i18n.language === "ms";
  const colors = {
    text: ink,
    subtleText: c.pageNumberColor,
    cardBg: c.innerBackground,
    cardBorder: c.frameColor,
  };

  return (
    <ReaderContentPage title={t("quran.guide.sajda.about.title")}>
      {guideEntriesByCategory(GuideCategory.SAJDA).map((entry) => (
        <GuideEntryCard
          key={entry.id}
          entry={entry}
          colors={colors}
          title={t(guideTextKey(entry.id, "title"))}
          body={t(guideTextKey(entry.id, "body"))}
          source={t(guideTextKey(entry.id, "source"), { defaultValue: "" }) || undefined}
          isArabic={isArabicLocale}
          isLatin={isLatinLocale}
        />
      ))}
    </ReaderContentPage>
  );
};

export default QuranSajdaScreen;
