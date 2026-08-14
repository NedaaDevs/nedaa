import { Image, Text, View } from "react-native";

import { OrnamentPanel, QURAN_FONT_FAMILY, quranBodyInk, toHafsDigits } from "@/constants/Quran";
import { MushafVersion, OrnamentAsset, OrnamentCategory, QuranThemeType } from "@/enums/quran";
import { resolveOrnamentImage } from "@/utils/quranOrnaments";
import { rubLabel, rubMarkParts } from "@/utils/juz";

// Three stacked lines as a printed mushaf sets them — quarter word, «الحزب»,
// then the hizb number — as fractions of the open panel's height. Keying them to
// the panel rather than the whole art keeps the same fill whatever frame a pack
// ships, since every pack measures its panel into pack.json.
const QUARTER_RATIO = 0.24;
const WORD_RATIO = 0.33;
const NUMBER_RATIO = 0.33;
// The mushaf font's metrics are tall; explicit line heights keep the stack tight
// inside the panel instead of letting it spread past the art.
const LINE_TIGHTNESS = 1.08;

// Plaque marking the rub (hizb quarter) a page opens, its localized label drawn
// in the art's open panel. Pointer-transparent; the caller places it.
const HizbMedallion = ({
  rub,
  width,
  height,
  version,
  quranTheme,
  styleId,
  panel,
}: {
  rub: number;
  width: number;
  height: number;
  version: MushafVersion;
  quranTheme: QuranThemeType;
  styleId: string;
  panel?: OrnamentPanel;
}) => {
  const source = resolveOrnamentImage(
    OrnamentCategory.PAGE_HOLDER,
    OrnamentAsset.HIZB,
    quranTheme,
    version,
    styleId
  );

  const label = rubLabel(rub);
  const { quarter, word, hizb } = rubMarkParts(rub);
  const typeStyle = {
    fontFamily: QURAN_FONT_FAMILY,
    color: quranBodyInk(quranTheme),
    textAlign: "center" as const,
    // Android pads each line by the font's own (very tall) metrics, which would
    // push the stack past the panel that the tight line heights below fit it to.
    includeFontPadding: false,
  };
  const panelHeight = height * ((panel?.b ?? 1) - (panel?.t ?? 0));
  const lineStyle = (ratio: number) => ({
    fontSize: panelHeight * ratio,
    lineHeight: panelHeight * ratio * LINE_TIGHTNESS,
  });

  // panel l/t are start fractions and r/b END fractions, so the right/bottom
  // insets are the remainders past the panel's end.
  const panelBox = {
    position: "absolute" as const,
    left: width * (panel?.l ?? 0),
    top: height * (panel?.t ?? 0),
    right: width * (1 - (panel?.r ?? 1)),
    bottom: height * (1 - (panel?.b ?? 1)),
  };

  return (
    // The three lines are one mark, so the whole plaque reads as a single
    // localized label instead of three Arabic fragments.
    <View
      pointerEvents="none"
      accessible
      accessibilityLabel={label}
      importantForAccessibility="no-hide-descendants"
      style={{ width, height }}>
      {/* The tint is baked into the art's whole silhouette, so there is no fill
          rect here. */}
      <Image source={source} style={{ width, height }} resizeMode="contain" fadeDuration={0} />
      <View style={{ ...panelBox, alignItems: "center", justifyContent: "center" }}>
        {/* allowFontScaling is off because the art can't grow with the OS font
            size — the type shrinks to the panel instead. Only the quarter line
            refits: it is the one that varies in length («ثلاث ارباع»). */}
        {quarter ? (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            allowFontScaling={false}
            style={{ ...typeStyle, ...lineStyle(QUARTER_RATIO) }}>
            {quarter}
          </Text>
        ) : null}
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={{ ...typeStyle, ...lineStyle(WORD_RATIO) }}>
          {word}
        </Text>
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={{ ...typeStyle, ...lineStyle(NUMBER_RATIO) }}>
          {toHafsDigits(hizb)}
        </Text>
      </View>
    </View>
  );
};

export default HizbMedallion;
