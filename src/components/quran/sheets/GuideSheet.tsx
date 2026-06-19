import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { YStack } from "tamagui";

import { Text } from "@/components/ui/text";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { QuranThemeType } from "@/enums/quran";
import { type GuideEntry, guideTextKey } from "@/types/guide";
import { GuideEntryCard } from "@/components/quran/library/GuideEntryCard";
import ReaderBottomSheet from "@/components/quran/sheets/ReaderBottomSheet";

interface GuideSheetProps {
  // The entries to show (a tajweed legend, a sajda explanation + dua, a single
  // waqf sign…) and the sheet's header key. Caller decides what to surface.
  entries: GuideEntry[];
  titleKey: string;
  quranTheme: QuranThemeType;
  onClose: () => void;
}

// In-reader contextual guide: the same cards as the Library Guide tab, themed to the
// reader's paper and shown as a scrollable bottom sheet over the page.
const GuideSheet = ({ entries, titleKey, quranTheme, onClose }: GuideSheetProps) => {
  const { t, i18n } = useTranslation();
  const c = QURAN_THEME_COLORS[quranTheme];
  const insets = useSafeAreaInsets();
  const isArabic = i18n.language === "ar";
  const isLatin = i18n.language === "en" || i18n.language === "ms";
  const colors = {
    text: c.textTint ?? c.headerColor,
    subtleText: c.pageNumberColor,
    cardBg: c.innerBackground,
    cardBorder: c.frameColor,
    heading: c.headerColor,
  };

  return (
    <ReaderBottomSheet onClose={onClose} quranTheme={quranTheme} scrollable name="guide">
      <Text fontSize={15} fontWeight="700" color={c.headerColor} paddingBottom="$2">
        {t(titleKey)}
      </Text>
      <BottomSheetScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        showsVerticalScrollIndicator={false}>
        <YStack gap="$3">
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
        </YStack>
      </BottomSheetScrollView>
    </ReaderBottomSheet>
  );
};

export default GuideSheet;
