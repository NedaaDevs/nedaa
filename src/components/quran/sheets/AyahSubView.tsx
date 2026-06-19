import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable } from "react-native";
import { GestureDetector, type PanGesture } from "react-native-gesture-handler";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { AyahSubViewKind, QuranThemeType } from "@/enums/quran";
import { guideEntriesByCategory } from "@/services/guide-content";
import { GuideCategory, guideTextKey } from "@/types/guide";
import { MutashabihatGroup } from "@/types/mutashabihat";
import { useQuranStore } from "@/stores/quran";
import { useRTL } from "@/contexts/RTLContext";
import { localizedSurahName } from "@/utils/surahName";
import { formatNumberToLocale } from "@/utils/number";
import { GuideEntryCard } from "@/components/quran/library/GuideEntryCard";
import { buildTajweedCards } from "@/components/quran/tajweed-cards";
import { MutashabihatView } from "@/components/quran/sheets/MutashabihatView";

interface AyahSubViewProps {
  kind: AyahSubViewKind;
  surah: number;
  ayah: number;
  quranTheme: QuranThemeType;
  // Already fetched by the action sheet; the sub-view just renders them.
  group: MutashabihatGroup | null;
  tajweed: { index: number; hex: string }[];
  onBack: () => void;
  onGoTo: (surah: number, ayah: number, page: number) => void;
  // Drives the panel's drag-to-go-back; attached to the header (a non-scroll zone).
  dragGesture: PanGesture;
}

// The ayah sub-views (similar verses, tajweed, sajda) rendered as the action sheet's
// body. Swapping the body (vs. a second stacked modal) keeps it a single sheet, so
// closing the sub-view reliably returns to the action view.
const AyahSubView = ({
  kind,
  surah,
  ayah,
  quranTheme,
  group,
  tajweed,
  onBack,
  onGoTo,
  dragGesture,
}: AyahSubViewProps) => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useRTL();
  const mutashabihatNotes = useQuranStore((s) => s.mutashabihatNotes);
  const setMutashabihatNote = useQuranStore((s) => s.setMutashabihatNote);
  const c = QURAN_THEME_COLORS[quranTheme];
  const ink = c.textTint ?? c.headerColor;
  const insets = useSafeAreaInsets();

  const RowChevron = isRTL ? ChevronLeft : ChevronRight;
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;
  const isArabicLocale = i18n.language === "ar";
  const isLatinLocale = i18n.language === "en" || i18n.language === "ms";
  const cardColors = {
    text: ink,
    subtleText: c.pageNumberColor,
    cardBg: c.innerBackground,
    cardBorder: c.frameColor,
    heading: c.headerColor,
  };
  const title =
    kind === AyahSubViewKind.MUTASHABIHAT
      ? t("quran.mutashabihat.title")
      : kind === AyahSubViewKind.TAJWEED
        ? t("quran.tajweed.title")
        : t("quran.guide.sajda.about.title");
  const ayahRef = `${localizedSurahName(surah)} ${formatNumberToLocale(String(ayah))}`;
  const tajweedCards = buildTajweedCards(tajweed, t);

  return (
    <>
      <GestureDetector gesture={dragGesture}>
        <XStack alignItems="center" gap="$2" paddingBottom="$2">
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            hitSlop={8}
            style={{ minHeight: 32, justifyContent: "center" }}>
            <BackIcon size={22} color={c.headerColor} />
          </Pressable>
          <Text fontSize={15} fontWeight="700" color={c.headerColor} flex={1}>
            {title}
          </Text>
          <Text fontSize={13} color={c.pageNumberColor}>
            {ayahRef}
          </Text>
        </XStack>
      </GestureDetector>

      <BottomSheetScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <YStack gap="$4">
          {kind === AyahSubViewKind.MUTASHABIHAT && group ? (
            <MutashabihatView
              group={group}
              quranTheme={quranTheme}
              isArabic={isArabicLocale}
              note={mutashabihatNotes[group.id] ?? ""}
              onChangeNote={(text) => setMutashabihatNote(group.id, text)}
              RowChevron={RowChevron}
              onGoTo={onGoTo}
            />
          ) : null}

          {kind === AyahSubViewKind.TAJWEED
            ? tajweedCards.map((card) => (
                <GuideEntryCard
                  key={card.key}
                  entry={card.entry}
                  colors={cardColors}
                  title={card.title}
                  body={card.body}
                  isArabic={isArabicLocale}
                  isLatin={isLatinLocale}
                />
              ))
            : null}

          {kind === AyahSubViewKind.SAJDA
            ? guideEntriesByCategory(GuideCategory.SAJDA).map((entry) => (
                <GuideEntryCard
                  key={entry.id}
                  entry={entry}
                  colors={cardColors}
                  title={t(guideTextKey(entry.id, "title"))}
                  body={t(guideTextKey(entry.id, "body"))}
                  source={t(guideTextKey(entry.id, "source"), { defaultValue: "" }) || undefined}
                  isArabic={isArabicLocale}
                  isLatin={isLatinLocale}
                />
              ))
            : null}
        </YStack>
      </BottomSheetScrollView>
    </>
  );
};

export default AyahSubView;
