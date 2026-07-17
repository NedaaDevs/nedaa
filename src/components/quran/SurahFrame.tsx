import { useMemo } from "react";
import { Image, Text, View } from "react-native";

import { ORNAMENT_INKS, OrnamentPanel } from "@/constants/Quran";
import { MushafVersion, OrnamentAsset, OrnamentCategory, QuranThemeType } from "@/enums/quran";
import { ornamentThemeSlot, resolveOrnamentImage } from "@/utils/quranOrnaments";
import { metadataFontFamily, SURAH_NAME_LIGATURE_FONT, surahNameLigature } from "@/utils/surahName";

// Soft wash inside the frame's text-safe panel (skipped when the style carries
// no panel metadata). Opacity as a hex suffix (~12%).
const FILL_ALPHA = "1F";

interface SurahFrameProps {
  x: number;
  y: number;
  width: number;
  height: number;
  surahNumber: number;
  version: MushafVersion;
  quranTheme: QuranThemeType;
  styleId: string;
  // TEXT mode: render this name centered inside the frame's text-safe panel
  // (MADINAH pages leave it unset — the calligraphic name is baked into the
  // page image and the frame draws underneath it).
  label?: string;
  panel?: OrnamentPanel;
  labelColor?: string;
}

// Decorative surah-opening frame drawn UNDER the line images at the surah-header
// line. Pure ornament: pointer-transparent, decorative-only (no a11y role).
const SurahFrame = ({
  x,
  y,
  width,
  height,
  surahNumber,
  version,
  quranTheme,
  styleId,
  label,
  panel,
  labelColor,
}: SurahFrameProps) => {
  const source = useMemo(
    () =>
      resolveOrnamentImage(
        OrnamentCategory.SURAH_FRAME,
        OrnamentAsset.FRAME,
        quranTheme,
        version,
        styleId
      ),
    [quranTheme, version, styleId]
  );
  // Arabic-script locales render the calligraphic vocalized name glyph, like
  // the baked band on MADINAH pages; Latin locales keep the transliteration.
  const ligature = label ? surahNameLigature(surahNumber) : null;
  const inkColor = ORNAMENT_INKS[ornamentThemeSlot(quranTheme)];
  const panelH = panel ? height * (panel.b - panel.t) : 0;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: x, top: y, width, height }}>
      {panel ? (
        // panel l/t are start fractions and r/b END fractions (r > l, b > t).
        <View
          style={{
            position: "absolute",
            left: width * panel.l,
            top: height * panel.t,
            width: width * (panel.r - panel.l),
            height: panelH,
            borderRadius: panelH * 0.25,
            backgroundColor: `${inkColor}${FILL_ALPHA}`,
          }}
        />
      ) : null}
      <Image source={source} style={{ width, height }} resizeMode="contain" fadeDuration={0} />
      {label ? (
        // panel l/t are start fractions and r/b END fractions (r > l, b > t),
        // so the right/bottom insets are the remainders past the panel's end.
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: width * (panel?.l ?? 0),
            top: height * (panel?.t ?? 0),
            right: width * (1 - (panel?.r ?? 1)),
            bottom: height * (1 - (panel?.b ?? 1)),
            alignItems: "center",
            justifyContent: "center",
          }}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={label}
            style={{
              fontFamily: ligature ? SURAH_NAME_LIGATURE_FONT : metadataFontFamily(),
              fontSize: height * (ligature ? 0.5 : 0.42),
              color: labelColor,
              textAlign: "center",
            }}>
            {ligature ?? label}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

export default SurahFrame;
