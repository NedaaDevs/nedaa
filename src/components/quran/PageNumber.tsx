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
  toHafsDigits,
} from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import {
  effectiveOrnamentStyle,
  ornamentThemeSlot,
  resolveOrnamentImage,
} from "@/utils/quranOrnaments";

interface PageNumberProps {
  page: number;
  quranTheme: QuranThemeType;
  version: MushafVersion;
}

// Height of the footer cartouche; the digits sit centered inside its open panel.
const HOLDER_HEIGHT = 24;
const DIGIT_FONT_SIZE = 17;

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
const PageNumber = ({ page, quranTheme, version }: PageNumberProps) => {
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
  // Digits match the holder's pre-tinted ink, not the theme token.
  const inkColor = ORNAMENT_INKS[ornamentThemeSlot(quranTheme)];

  return (
    <YStack alignItems="center" paddingTop="$2" style={{ paddingBottom: insets.bottom }}>
      {holderPresent ? (
        <View
          style={{ width: holderWidth, height: HOLDER_HEIGHT }}
          accessibilityLabel={t("a11y.quran.page", { page })}>
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
              fill={inkColor}
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
