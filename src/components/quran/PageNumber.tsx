import { Image, Platform, View } from "react-native";
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
  resolveOrnamentImage,
} from "@/utils/quranOrnaments";
import HizbPageMarker from "@/components/quran/HizbPageMarker";

interface PageNumberProps {
  page: number;
  quranTheme: QuranThemeType;
  version: MushafVersion;
  // Rub (hizb quarter) starting on this page — adds the hizb plaque beside the
  // page number. Null/absent = page number alone.
  rub?: number | null;
  side?: "left" | "right" | "single";
  // Free space under the page's lowest ink, in points — the room the plaque may
  // rise into. Null when the page hasn't measured or carries no glyph data.
  clearance?: number | null;
}

// Height of the footer cartouche; the digits sit centered inside its open panel.
const HOLDER_HEIGHT = 24;
const FOOTER_PAD_TOP = 8;
const DIGIT_FONT_SIZE = 17;
// The hizb plaque rises above the page number by the footer band plus the space
// the page leaves under its last line, less this gap that keeps the crown off
// the script. Clamped so the label stays readable and never outgrows the footer.
const HIZB_INK_GAP = 6;
const HIZB_TOP_MIN = 30;
const HIZB_TOP_MAX = 52;
// Used until a page reports its clearance; clears even the deepest last lines.
const HIZB_TOP_FALLBACK = 38;
// The rest of the height comes from hanging into the bottom inset.
const HIZB_MAX_DROP = 24;
// Steps in from the edge as far as it hangs below, so the display's rounded
// corner never clips it.
const HIZB_EDGE_INSET = 20;

// Soft wash inside the holder's inner panel (fractions of the holder box).
const FILL_ALPHA = "1F"; // ~12%
const HOLDER_FILL = { w: 0.62, h: 0.6 };

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
// boxes disagree between iOS and Android for this font's tall metrics. Bare
// digits when no holder art resolves. Bottom padding clears the home-indicator /
// swipe-to-close strip.
const PageNumber = ({ page, quranTheme, version, rub, side, clearance }: PageNumberProps) => {
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
  // Spread leaves carry the plaque in their outer margin, as a printed mushaf
  // does; a single page keeps it on one side so it doesn't hop as pages turn.
  const hizbEdge = side === "left" || side === "right" ? side : "right";
  const hizbDrop = Math.min(insets.bottom, HIZB_MAX_DROP);
  const hizbInset = HIZB_EDGE_INSET + hizbDrop;
  const hizbTop =
    clearance == null
      ? HIZB_TOP_FALLBACK
      : Math.min(
          HIZB_TOP_MAX,
          Math.max(HIZB_TOP_MIN, FOOTER_PAD_TOP + HOLDER_HEIGHT + clearance - HIZB_INK_GAP)
        );

  return (
    <YStack
      alignItems="center"
      paddingTop={FOOTER_PAD_TOP}
      // direction ltr pins the plaque's physical side under RTL locales, where
      // RN otherwise resolves left/right against the writing direction.
      style={{ paddingBottom: insets.bottom, direction: "ltr" }}>
      {rub != null ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: insets.bottom - hizbDrop,
            ...(hizbEdge === "right" ? { right: hizbInset } : { left: hizbInset }),
          }}>
          <HizbPageMarker
            rub={rub}
            height={hizbTop + hizbDrop}
            version={version}
            quranTheme={quranTheme}
          />
        </View>
      ) : null}
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
              // x/y place the text in the SVG's own coordinates. The deprecation
              // belongs to the transform shorthands of the same name, which
              // TextProps inherits from TransformProps.
              // eslint-disable-next-line @typescript-eslint/no-deprecated
              x={holderWidth / 2 + DIGIT_NUDGE.x}
              // eslint-disable-next-line @typescript-eslint/no-deprecated
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
          {toHafsDigits(page)}
        </Text>
      )}
    </YStack>
  );
};

export default PageNumber;
