import { useEffect, useState } from "react";
import { Sheet, XStack, YStack } from "tamagui";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { MushafVersion, QuranThemeType } from "@/enums/quran";
import { QuranContentDB } from "@/services/quran-content-db";
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
import ReaderSheet from "@/components/quran/sheets/ReaderSheet";

export type AyahSubViewKind = "mutashabihat" | "tajweed" | "sajda";
export type AyahSubViewTarget = { kind: AyahSubViewKind; surah: number; ayah: number };

interface Props {
  target: AyahSubViewTarget | null;
  quranTheme: QuranThemeType;
  onClose: () => void;
  onGoTo: (surah: number, ayah: number, page: number) => void;
}

// The ayah sub-views (similar verses, tajweed, sajda) as one bottom sheet, matching
// the ayah action sheet's chrome. Opened from a row there; closing reopens it.
const AyahSubSheet = ({ target, quranTheme, onClose, onGoTo }: Props) => {
  const { t, i18n } = useTranslation();
  const { isRTL } = useRTL();
  const version = useQuranStore((s) => s.currentVersion);
  const mutashabihatNotes = useQuranStore((s) => s.mutashabihatNotes);
  const setMutashabihatNote = useQuranStore((s) => s.setMutashabihatNote);
  const c = QURAN_THEME_COLORS[quranTheme];
  const ink = c.textTint ?? c.headerColor;

  const [group, setGroup] = useState<MutashabihatGroup | null>(null);
  const [tajweed, setTajweed] = useState<{ index: number; hex: string }[]>([]);

  const kind = target?.kind;
  const surah = target?.surah;
  const ayah = target?.ayah;
  useEffect(() => {
    if (!kind || !surah || !ayah) return;
    let cancelled = false;
    setGroup(null);
    setTajweed([]);
    if (kind === "mutashabihat") {
      QuranContentDB.getMutashabihatGroupForAyah(surah, ayah).then((g) => {
        if (!cancelled) setGroup(g);
      });
    } else if (kind === "tajweed" && version === MushafVersion.V4) {
      QuranContentDB.getAyahTajweed(version, surah, ayah).then((r) => {
        if (!cancelled) setTajweed(r);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [kind, surah, ayah, version]);

  if (!target) return null;

  const RowChevron = isRTL ? ChevronLeft : ChevronRight;
  const isArabicLocale = i18n.language === "ar";
  const isLatinLocale = i18n.language === "en" || i18n.language === "ms";
  const cardColors = {
    text: ink,
    subtleText: c.pageNumberColor,
    cardBg: c.innerBackground,
    cardBorder: c.frameColor,
  };
  const title =
    kind === "mutashabihat"
      ? t("quran.mutashabihat.title")
      : kind === "tajweed"
        ? t("quran.tajweed.title")
        : t("quran.guide.sajda.about.title");
  const ayahRef = `${localizedSurahName(target.surah)} ${formatNumberToLocale(String(target.ayah))}`;
  const tajweedCards = buildTajweedCards(tajweed, t);

  return (
    <ReaderSheet onClose={onClose} quranTheme={quranTheme} snapPoints={[85]}>
      <XStack alignItems="center" gap="$2" paddingBottom="$2">
        <Text fontSize={15} fontWeight="700" color={c.headerColor} flex={1}>
          {title}
        </Text>
        <Text fontSize={13} color={c.pageNumberColor}>
          {ayahRef}
        </Text>
      </XStack>

      <Sheet.ScrollView
        flex={1}
        contentContainerStyle={{ paddingBottom: 4 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <YStack gap="$4">
          {kind === "mutashabihat" && group ? (
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

          {kind === "tajweed"
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

          {kind === "sajda"
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
      </Sheet.ScrollView>
    </ReaderSheet>
  );
};

export default AyahSubSheet;
