import { useMemo } from "react";
import { Image, Text, View } from "react-native";

import { OrnamentPanel } from "@/constants/Quran";
import { MushafVersion, OrnamentAsset, OrnamentCategory, QuranThemeType } from "@/enums/quran";
import { resolveOrnamentImage } from "@/utils/quranOrnaments";
import { metadataFontFamily } from "@/utils/surahName";

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
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: x, top: y, width, height }}>
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
            style={{
              fontFamily: metadataFontFamily(),
              fontSize: height * 0.42,
              color: labelColor,
              textAlign: "center",
            }}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

export default SurahFrame;
