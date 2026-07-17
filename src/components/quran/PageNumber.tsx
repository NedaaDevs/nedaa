import { Image } from "react-native";
import { YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { MushafVersion, OrnamentAsset, OrnamentCategory, QuranThemeType } from "@/enums/quran";
import {
  BUNDLED_ORNAMENT_META,
  NEDAA_STYLE_ID,
  ORNAMENT_INKS,
  QURAN_FONT_FAMILY,
  QURAN_THEME_COLORS,
  toHafsDigits,
} from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import { ornamentThemeSlot, resolveOrnamentImage } from "@/utils/quranOrnaments";

interface PageNumberProps {
  page: number;
  quranTheme: QuranThemeType;
  version: MushafVersion;
}

// Height of the footer cartouche; the digits sit centered inside its open panel.
const HOLDER_HEIGHT = 24;

// Page number over the page-holder cartouche. Falls back to ornate parentheses
// (U+FD3F/U+FD3E, code order = RTL reading order → ﴾ N ﴿) when no holder art
// resolves. Bottom padding clears the home-indicator / swipe-to-close strip.
const PageNumber = ({ page, quranTheme, version }: PageNumberProps) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const themeColors = QURAN_THEME_COLORS[quranTheme];

  const holderStyle =
    useQuranStore((s) => s.ornamentStyle[OrnamentCategory.PAGE_HOLDER]) ?? NEDAA_STYLE_ID;
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
              writingDirection: "rtl",
              fontSize: 17,
              // Center the glyphs optically in the holder: no Android font-box
              // padding, and the line box spans the holder so the baseline sits
              // mid-panel rather than hanging from the text box's top.
              includeFontPadding: false,
              lineHeight: HOLDER_HEIGHT,
              textAlign: "center",
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
