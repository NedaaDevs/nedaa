import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { YStack } from "tamagui";

import { Text } from "@/components/ui/text";
import { QuranThemeType, RevelationPlace } from "@/enums/quran";
import { QURAN_THEME_COLORS } from "@/constants/Quran";
import { QuranContentDB } from "@/services/quran-content-db";
import { formatNumberToLocale } from "@/utils/number";
import { localizedSurahName, metadataFontFamily } from "@/utils/surahName";
import type { SurahMeta } from "@/types/quran";
import ReaderSheet from "@/components/quran/sheets/ReaderSheet";

interface SurahInfoCardProps {
  // Null when closed; the sheet stays mounted and animates out.
  surahNumber: number | null;
  quranTheme: QuranThemeType;
  onClose: () => void;
}

// Surah info on a long-press of the surah header — the reader-themed sheet
// (bottom sheet on phones, dialog on large), showing the surah name in the
// current locale plus its revelation place, verse count, and page range.
const SurahInfoCard = ({ surahNumber, quranTheme, onClose }: SurahInfoCardProps) => {
  const { t } = useTranslation();
  const c = QURAN_THEME_COLORS[quranTheme];
  // Retain the last surah while the sheet animates closed (surahNumber → null).
  const [shown, setShown] = useState<number | null>(surahNumber);
  const [meta, setMeta] = useState<SurahMeta | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (surahNumber !== null) setShown(surahNumber);
  }, [surahNumber]);

  useEffect(() => {
    if (shown === null) return;
    let active = true;
    QuranContentDB.getSurah(shown).then((m) => {
      if (active) setMeta(m);
    });
    return () => {
      active = false;
    };
  }, [shown]);

  const ready = meta !== null && shown !== null;
  const place =
    meta?.revelationPlace === RevelationPlace.MAKKAH
      ? t("quran.surah.makki")
      : t("quran.surah.madani");
  const metaLine = ready
    ? [
        place,
        t("quran.surah.ayahCount", { n: formatNumberToLocale(String(meta!.ayahCount)) }),
        t("quran.surah.pages", {
          start: formatNumberToLocale(String(meta!.pageStart)),
          end: formatNumberToLocale(String(meta!.pageEnd)),
        }),
      ].join("  ·  ")
    : "";

  return (
    <ReaderSheet open={surahNumber !== null} onClose={onClose} quranTheme={quranTheme}>
      {ready && (
        <YStack gap="$2" paddingBottom="$2">
          <Text
            style={{
              fontSize: 22,
              lineHeight: 36,
              fontWeight: "700",
              color: c.headerColor,
              fontFamily: metadataFontFamily(),
            }}>
            {localizedSurahName(shown!)}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: "600", color: c.pageNumberColor }}>
            {metaLine}
          </Text>
        </YStack>
      )}
    </ReaderSheet>
  );
};

export default SurahInfoCard;
