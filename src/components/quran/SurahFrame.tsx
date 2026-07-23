import { useMemo } from "react";
import { Image, Text, View } from "react-native";

import { ORNAMENT_INKS, OrnamentPanel } from "@/constants/Quran";
import { MushafVersion, OrnamentAsset, OrnamentCategory, QuranThemeType } from "@/enums/quran";
import { ornamentThemeSlot, resolveOrnamentImage } from "@/utils/quranOrnaments";
import {
  isArabicScript,
  metadataFontFamily,
  surahNameLigature,
  surahNameLigatureFont,
} from "@/utils/surahName";

// Soft wash filling the frame's whole plaque. Opacity as a hex suffix (~12%).
const FILL_ALPHA = "1F";
// Corner rounding of the wash, as a fraction of the frame's drawn height —
// tracks the rounded outer boundary of the frame art.
const FILL_RADIUS_RATIO = 0.16;

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
  // Frame art aspect (w/h) from the pack metadata, used to place the wash under
  // the letterboxed image. Without it the wash falls back to the layout box.
  aspect?: number;
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
  aspect,
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
  const ligature = label && isArabicScript() ? surahNameLigature(surahNumber, version) : null;
  const inkColor = ORNAMENT_INKS[ornamentThemeSlot(quranTheme)];
  // The <Image> below is `resizeMode="contain"`, so its drawn rect is
  // letterboxed inside width×height. Mirror that math here so the wash sits
  // under the actual art rather than the (possibly larger) layout box.
  const drawnHeight = aspect !== undefined ? Math.min(width / aspect, height) : height;
  const drawnWidth = aspect !== undefined ? aspect * drawnHeight : width;
  const drawnLeft = (width - drawnWidth) / 2;
  const drawnTop = (height - drawnHeight) / 2;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: x, top: y, width, height }}>
      <View
        style={{
          position: "absolute",
          left: drawnLeft,
          top: drawnTop,
          width: drawnWidth,
          height: drawnHeight,
          borderRadius: drawnHeight * FILL_RADIUS_RATIO,
          backgroundColor: `${inkColor}${FILL_ALPHA}`,
        }}
      />
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
              fontFamily: ligature ? surahNameLigatureFont(version) : metadataFontFamily(),
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
