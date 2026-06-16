import { ScrollView, useWindowDimensions } from "react-native";
import { YStack } from "tamagui";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { QuranThemeType } from "@/enums/quran";
import { type GuideEntry, guideTextKey } from "@/types/guide";
import ReaderSheet from "@/components/quran/sheets/ReaderSheet";
import { GuideEntryCard } from "@/components/quran/library/GuideEntryCard";

interface GuideSheetProps {
  // The entries to show (a tajweed legend, a sajda explanation + dua, a single
  // waqf sign…) and the sheet's header key. Caller decides what to surface.
  entries: GuideEntry[];
  titleKey: string;
  quranTheme: QuranThemeType;
  onClose: () => void;
}

// In-reader contextual guide: the same cards as the Library Guide tab, themed to
// the reader's paper and shown as a bottom sheet over the page.
const GuideSheet = ({ entries, titleKey, quranTheme, onClose }: GuideSheetProps) => {
  const { t, i18n } = useTranslation();
  const { height } = useWindowDimensions();
  const c = QURAN_THEME_COLORS[quranTheme];
  const isArabic = i18n.language === "ar";
  const isLatin = i18n.language === "en" || i18n.language === "ms";
  const colors = {
    text: c.textTint ?? c.headerColor,
    subtleText: c.pageNumberColor,
    cardBg: c.innerBackground,
    cardBorder: c.frameColor,
  };

  return (
    <ReaderSheet onClose={onClose} quranTheme={quranTheme}>
      <YStack gap="$3">
        <Text fontSize={15} fontWeight="700" color={c.headerColor}>
          {t(titleKey)}
        </Text>
        <ScrollView
          style={{ maxHeight: height * 0.6 }}
          contentContainerStyle={{ gap: 8 }}
          showsVerticalScrollIndicator={false}>
          {entries.map((entry) => (
            <GuideEntryCard
              key={entry.id}
              entry={entry}
              colors={colors}
              title={t(guideTextKey(entry.id, "title"))}
              body={t(guideTextKey(entry.id, "body"))}
              source={t(guideTextKey(entry.id, "source"), { defaultValue: "" }) || undefined}
              isArabic={isArabic}
              isLatin={isLatin}
            />
          ))}
        </ScrollView>
      </YStack>
    </ReaderSheet>
  );
};

export default GuideSheet;
