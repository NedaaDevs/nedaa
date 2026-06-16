import { Image, Text as RNText } from "react-native";
import { YStack } from "tamagui";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import { MushafVersion, QuranThemeType, ShareCardStyle } from "@/enums/quran";
import { QURAN_THEME_COLORS, QURAN_TEXT_FONT, isDarkPaper } from "@/constants/Quran";
import { metadataFontFamily } from "@/utils/surahName";
import AyahImage from "@/components/quran/AyahImage";

// Theme-aware logomark: gold on dark paper, teal on light — both transparent.
const LOGO = {
  light: require("../../../assets/images/ios-light.png"),
  dark: require("../../../assets/images/ios-dark.png"),
};

interface AyahShareCardProps {
  version: MushafVersion;
  page: number;
  surah: number;
  ayah: number;
  quranTheme: QuranThemeType;
  style: ShareCardStyle;
  includeLogo: boolean;
  text: string;
  surahName: string;
  ayahRef: string;
  width: number;
  // Falls back to the text card when the Mushaf image can't render (edition not
  // downloaded for this page).
  imageAvailable: boolean;
}

const PADDING = 26;

// The shareable ayah card — the capture target for image sharing. Paper-themed,
// the verse rendered either as its actual-edition Mushaf image or as Hafs text,
// with the reference and an optional Nedaa logo. Multi-line ayahs render fully:
// AyahImage stacks one strip per line; the text card wraps naturally. The verse
// and reference use raw RN Text because the Quran/metadata faces are plain font
// families, not Tamagui font tokens (same as AyahText/TextPage).
const AyahShareCard = ({
  version,
  page,
  surah,
  ayah,
  quranTheme,
  style,
  includeLogo,
  text,
  surahName,
  ayahRef,
  width,
  imageAvailable,
}: AyahShareCardProps) => {
  const { t } = useTranslation();
  const c = QURAN_THEME_COLORS[quranTheme];
  const ink = c.textTint ?? c.headerColor;
  const dark = isDarkPaper(quranTheme);
  const asImage = style === ShareCardStyle.IMAGE && imageAvailable;

  const verseText = (
    <RNText
      style={{
        fontSize: 26,
        lineHeight: 52,
        textAlign: "center",
        writingDirection: "rtl",
        fontFamily: QURAN_TEXT_FONT,
        color: ink,
      }}>
      {text}
    </RNText>
  );

  return (
    <YStack
      width={width}
      backgroundColor={c.innerBackground}
      borderRadius={20}
      borderWidth={1}
      borderColor={c.frameColor}
      paddingHorizontal={PADDING}
      paddingVertical={PADDING + 6}
      alignItems="center"
      gap={18}>
      {/* Surah · ayah reference (metadata face → raw RN Text) */}
      <RNText style={{ fontSize: 15, fontWeight: "700", color: c.frameColor }}>
        <RNText style={{ fontFamily: metadataFontFamily() }}>{surahName}</RNText>
        {`  ·  ${ayahRef}`}
      </RNText>

      {/* The verse */}
      {asImage ? (
        <AyahImage
          version={version}
          page={page}
          surah={surah}
          ayah={ayah}
          quranTheme={quranTheme}
          maxWidth={width - PADDING * 2}
          fallback={verseText}
        />
      ) : (
        verseText
      )}

      {/* Optional watermark: a restrained footer — hairline rule, small logomark,
          and a muted uppercase attribution line (the "some text" carried on the
          image when branding is on). */}
      {includeLogo && (
        <YStack alignItems="center" gap={8} marginTop={6}>
          <YStack width={36} height={1} backgroundColor={c.frameColor} opacity={0.3} />
          <YStack alignItems="center" gap={5}>
            <Image
              source={dark ? LOGO.dark : LOGO.light}
              style={{ width: 24, height: 24 }}
              resizeMode="contain"
            />
            <Text
              fontSize={9}
              fontWeight="700"
              letterSpacing={1.2}
              color={c.pageNumberColor}
              style={{ textTransform: "uppercase" }}>
              {t("quran.share.tagline")}
            </Text>
          </YStack>
        </YStack>
      )}
    </YStack>
  );
};

export default AyahShareCard;
