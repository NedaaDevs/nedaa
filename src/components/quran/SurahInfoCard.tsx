import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { QuranTheme, RevelationPlace } from "@/enums/quran";
import { QURAN_THEME_COLORS, QURAN_FONT_FAMILY } from "@/constants/Quran";
import { QuranContentDB } from "@/services/quran-content-db";
import type { SurahMeta } from "@/types/quran";

interface SurahInfoCardProps {
  surahNumber: number;
  quranTheme: QuranTheme;
  onClose: () => void;
}

// Interim surah info shown on a long-press of the surah header, until the full
// per-ayah/surah action sheet (release 2.11) replaces it.
const SurahInfoCard = ({ surahNumber, quranTheme, onClose }: SurahInfoCardProps) => {
  const { t } = useTranslation();
  const [meta, setMeta] = useState<SurahMeta | null>(null);
  const colors = QURAN_THEME_COLORS[quranTheme];

  useEffect(() => {
    let active = true;
    QuranContentDB.getSurah(surahNumber).then((m) => {
      if (active) setMeta(m);
    });
    return () => {
      active = false;
    };
  }, [surahNumber]);

  if (!meta) return null;

  const place =
    meta.revelationPlace === RevelationPlace.MAKKAH
      ? t("quran.surah.makki")
      : t("quran.surah.madani");

  return (
    <Pressable
      style={[StyleSheet.absoluteFill, styles.backdrop]}
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel={t("common.close")}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.background, borderColor: colors.markerColor },
        ]}>
        <Text style={[styles.name, { color: colors.headerColor, fontFamily: QURAN_FONT_FAMILY }]}>
          {meta.nameArabic}
        </Text>
        <Text style={[styles.translit, { color: colors.headerColor }]}>
          {meta.nameTransliterated}
        </Text>
        <Text style={[styles.meta, { color: colors.pageNumberColor }]}>
          {place} · {t("quran.surah.ayahCount", { count: meta.ayahCount })}
        </Text>
        <Text style={[styles.meta, { color: colors.pageNumberColor }]}>
          {t("quran.surah.pages", { start: meta.pageStart, end: meta.pageEnd })}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 20,
  },
  card: {
    minWidth: 220,
    maxWidth: "80%",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  name: { fontSize: 28, textAlign: "center" },
  translit: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  meta: { fontSize: 13, textAlign: "center" },
});

export default SurahInfoCard;
