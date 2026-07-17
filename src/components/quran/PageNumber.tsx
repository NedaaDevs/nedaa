import { Image, Platform } from "react-native";
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

// Optical centering nudge for the digits, per platform: text boxes center
// differently on iOS/Android for the Hafs font's tall metrics. Positive y moves
// the digits down, positive x moves them toward the trailing edge.
const DIGIT_NUDGE = Platform.select({
  ios: { x: 0, y: 0 },
  android: { x: 0, y: 0 },
  default: { x: 0, y: 0 },
}) as { x: number; y: number };

// Page number over the page-holder cartouche. Falls back to ornate parentheses
// (U+FD3F/U+FD3E, code order = RTL reading order → ﴾ N ﴿) when no holder art
// resolves. Bottom padding clears the home-indicator / swipe-to-close strip.
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
        <YStack
          width={holderWidth}
          height={HOLDER_HEIGHT}
          alignItems="center"
          justifyContent="center">
          <Image
            source={source}
            style={{ position: "absolute", width: holderWidth, height: HOLDER_HEIGHT }}
            resizeMode="contain"
            fadeDuration={0}
          />
          <Text
            style={{
              color: inkColor,
              fontFamily: QURAN_FONT_FAMILY,
              fontSize: 17,
              // Container-centered like AyahMarker's digits (no lineHeight —
              // iOS and Android disagree on baseline placement inside a line
              // box); DIGIT_NUDGE absorbs the residual per-platform offset.
              includeFontPadding: false,
              textAlign: "center",
              transform: [{ translateX: DIGIT_NUDGE.x }, { translateY: DIGIT_NUDGE.y }],
            }}
            accessibilityLabel={t("a11y.quran.page", { page })}>
            {toHafsDigits(page)}
          </Text>
        </YStack>
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
