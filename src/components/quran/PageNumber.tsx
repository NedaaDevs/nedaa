import { Image, Platform, Text as RNText, View } from "react-native";
import Svg, { Text as SvgText } from "react-native-svg";
import { YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { MushafVersion, OrnamentAsset, OrnamentCategory, QuranThemeType } from "@/enums/quran";
import {
  BUNDLED_ORNAMENT_META,
  ORNAMENT_INKS,
  QURAN_FONT_FAMILY,
  QURAN_THEME_COLORS,
  quranBodyInk,
  toHafsDigits,
} from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import {
  effectiveOrnamentStyle,
  ornamentThemeSlot,
  pageLeafSide,
  quarterHolderAsset,
  resolveOrnamentImage,
} from "@/utils/quranOrnaments";
import { rubLabel } from "@/utils/juz";

interface PageNumberProps {
  page: number;
  quranTheme: QuranThemeType;
  version: MushafVersion;
  // Rub (hizb quarter) starting on this page — switches the footer to the
  // two-cell quarter holder. Null/absent = normal cartouche.
  rubStart?: number | null;
  side?: "left" | "right" | "single";
}

// Height of the footer cartouche; the digits sit centered inside its open panel.
const HOLDER_HEIGHT = 24;
const DIGIT_FONT_SIZE = 17;
// Quarter holder: taller band, two cells. Narrow (digit) cell x-center as a
// width fraction of the narrow-left art (mirrored for narrow-right).
const QUARTER_HEIGHT = 28;
const QUARTER_NARROW_CENTER = 0.3;
// Wide cell's open interior, as fractions of the art's width/height — measured
// by flood-filling quarter-left-sepia.png from inside the cell (same technique
// as the surah-frame medallion boxes). Mirrored for the right leaf the same way
// narrowX mirrors below. Gives the hizb-quarter label a real box to fit instead
// of a bare center point, so long labels ("3/4 Hizb 60") shrink to fit rather
// than clipping against the plaque's rounded end.
const QUARTER_WIDE_BOX = { l: 0.4722, t: 0.2432, r: 0.8187, b: 0.765 };
const QUARTER_LABEL_FONT_SIZE = 12;

// Soft wash inside the holder's inner panel (fractions of the holder box).
const FILL_ALPHA = "1F"; // ~12%
const HOLDER_FILL = { w: 0.62, h: 0.6 };
const QUARTER_FILL = { w: 0.72, h: 0.58 };

// Final optical trim per platform, applied on top of the SVG centering below.
// Positive y moves the digits down, positive x toward the right.
const DIGIT_NUDGE = Platform.select({
  ios: { x: 0, y: 0 },
  android: { x: 0, y: 0 },
  default: { x: 0, y: 0 },
}) as { x: number; y: number };

// Page number over the page-holder cartouche. The digits are SVG text so both
// axes center deterministically across platforms: textAnchor centers by glyph
// advance, alignmentBaseline centers on the font's central baseline — RN Text
// boxes disagree between iOS and Android for this font's tall metrics. Falls
// back to ornate parentheses (U+FD3F/U+FD3E, code order = RTL reading order →
// ﴾ N ﴿) when no holder art resolves. Bottom padding clears the home-indicator
// / swipe-to-close strip.
const PageNumber = ({ page, quranTheme, version, rubStart, side }: PageNumberProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const themeColors = QURAN_THEME_COLORS[quranTheme];

  const holderStyle = useQuranStore((s) =>
    effectiveOrnamentStyle(
      s.ornamentStyle[OrnamentCategory.PAGE_HOLDER],
      s.ornamentResolved[OrnamentCategory.PAGE_HOLDER]?.[version]
    )
  );
  const holderMeta =
    useQuranStore((s) => s.ornamentMeta[OrnamentCategory.PAGE_HOLDER]) ??
    BUNDLED_ORNAMENT_META[OrnamentCategory.PAGE_HOLDER];
  const holderAssetMeta = holderMeta.assets[OrnamentAsset.CARTOUCHE];
  const holderPresent = holderAssetMeta !== undefined;
  const holderWidth = HOLDER_HEIGHT * (holderAssetMeta?.aspect ?? 3.24);
  const source = resolveOrnamentImage(
    OrnamentCategory.PAGE_HOLDER,
    OrnamentAsset.CARTOUCHE,
    quranTheme,
    version,
    holderStyle
  );
  // Wash fill matches the holder's pre-tinted gold ink.
  const inkColor = ORNAMENT_INKS[ornamentThemeSlot(quranTheme)];
  // Digits read as body ink (black/white), not the ornament gold.
  const textColor = quranBodyInk(quranTheme);

  // Rub-boundary pages replace the cartouche with the two-cell quarter holder,
  // side-anchored toward the page's outer edge.
  const leaf = pageLeafSide(page, side);
  const quarterAsset = quarterHolderAsset(leaf);
  const quarterMeta = holderMeta.assets[quarterAsset];
  if (rubStart != null && quarterMeta) {
    const qWidth = QUARTER_HEIGHT * quarterMeta.aspect;
    const qSource = resolveOrnamentImage(
      OrnamentCategory.PAGE_HOLDER,
      quarterAsset,
      quranTheme,
      version,
      holderStyle
    );
    // Narrow (page-number) cell sits toward the outer edge per the art file.
    const narrowX = leaf === "right" ? 1 - QUARTER_NARROW_CENTER : QUARTER_NARROW_CENTER;
    const wideBox =
      leaf === "right"
        ? {
            l: 1 - QUARTER_WIDE_BOX.r,
            t: QUARTER_WIDE_BOX.t,
            r: 1 - QUARTER_WIDE_BOX.l,
            b: QUARTER_WIDE_BOX.b,
          }
        : QUARTER_WIDE_BOX;
    const label = rubLabel(rubStart);
    return (
      <YStack
        alignItems={leaf === "right" ? "flex-end" : "flex-start"}
        paddingTop="$2"
        paddingHorizontal="$4"
        style={{ paddingBottom: insets.bottom }}>
        <View
          style={{ width: qWidth, height: QUARTER_HEIGHT }}
          accessibilityLabel={t("a11y.quran.pageQuarter", { page, quarter: label })}>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              alignSelf: "center",
              top: (QUARTER_HEIGHT * (1 - QUARTER_FILL.h)) / 2,
              width: qWidth * QUARTER_FILL.w,
              height: QUARTER_HEIGHT * QUARTER_FILL.h,
              borderRadius: (QUARTER_HEIGHT * QUARTER_FILL.h) / 2,
              backgroundColor: `${inkColor}${FILL_ALPHA}`,
            }}
          />
          <Image
            source={qSource}
            style={{ position: "absolute", width: qWidth, height: QUARTER_HEIGHT }}
            resizeMode="contain"
            fadeDuration={0}
          />
          <Svg width={qWidth} height={QUARTER_HEIGHT}>
            <SvgText
              x={qWidth * narrowX + DIGIT_NUDGE.x}
              y={QUARTER_HEIGHT / 2 + DIGIT_NUDGE.y}
              fontFamily={QURAN_FONT_FAMILY}
              fontSize={DIGIT_FONT_SIZE * 0.85}
              fill={textColor}
              textAnchor="middle"
              alignmentBaseline="central">
              {toHafsDigits(page)}
            </SvgText>
          </Svg>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: qWidth * wideBox.l,
              top: QUARTER_HEIGHT * wideBox.t,
              right: qWidth * (1 - wideBox.r),
              bottom: QUARTER_HEIGHT * (1 - wideBox.b),
              alignItems: "center",
              justifyContent: "center",
            }}>
            {/* RN Text over the wide cell, not SvgText: it can wrap/shrink to the
                box instead of clipping ("3/4 Hizb 60" in Latin locales overflows
                a fixed-size SVG label). allowFontScaling is off because the art's
                cell can't grow with the OS font size, so the label must instead
                shrink to it. */}
            <RNText
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              allowFontScaling={false}
              style={{
                fontFamily: QURAN_FONT_FAMILY,
                fontSize: QUARTER_LABEL_FONT_SIZE,
                color: textColor,
                textAlign: "center",
              }}>
              {label}
            </RNText>
          </View>
        </View>
      </YStack>
    );
  }

  return (
    <YStack alignItems="center" paddingTop="$2" style={{ paddingBottom: insets.bottom }}>
      {holderPresent ? (
        <View
          style={{ width: holderWidth, height: HOLDER_HEIGHT }}
          accessibilityLabel={t("a11y.quran.page", { page })}>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              alignSelf: "center",
              top: (HOLDER_HEIGHT * (1 - HOLDER_FILL.h)) / 2,
              width: holderWidth * HOLDER_FILL.w,
              height: HOLDER_HEIGHT * HOLDER_FILL.h,
              borderRadius: (HOLDER_HEIGHT * HOLDER_FILL.h) / 2,
              backgroundColor: `${inkColor}${FILL_ALPHA}`,
            }}
          />
          <Image
            source={source}
            style={{ position: "absolute", width: holderWidth, height: HOLDER_HEIGHT }}
            resizeMode="contain"
            fadeDuration={0}
          />
          <Svg width={holderWidth} height={HOLDER_HEIGHT}>
            <SvgText
              x={holderWidth / 2 + DIGIT_NUDGE.x}
              y={HOLDER_HEIGHT / 2 + DIGIT_NUDGE.y}
              fontFamily={QURAN_FONT_FAMILY}
              fontSize={DIGIT_FONT_SIZE}
              fill={textColor}
              textAnchor="middle"
              alignmentBaseline="central">
              {toHafsDigits(page)}
            </SvgText>
          </Svg>
        </View>
      ) : (
        <Text
          style={{
            color: themeColors.frameColor,
            fontFamily: QURAN_FONT_FAMILY,
            writingDirection: "rtl",
            fontSize: 19,
          }}
          accessibilityLabel={t("a11y.quran.page", { page })}>
          {`﴿ ${toHafsDigits(page)} ﴾`}
        </Text>
      )}
    </YStack>
  );
};

export default PageNumber;
