import { Image, Text, View } from "react-native";

import { OrnamentPanel, QURAN_FONT_FAMILY, quranBodyInk, toHafsDigits } from "@/constants/Quran";
import { MushafVersion, OrnamentAsset, OrnamentCategory, QuranThemeType } from "@/enums/quran";
import { resolveOrnamentImage } from "@/utils/quranOrnaments";
import { rubForHizbQuarter, rubLabel, rubMarkParts } from "@/utils/juz";

type LabelSlot = { top: number; height: number; font: number };

// Fixed slots prevent one line's font metrics from pushing another into the
// frame. Fractions are relative to the text-safe panel measured in pack.json.
const THREE_LINE_SLOTS = {
  quarter: { top: 0, height: 0.31, font: 0.29 },
  word: { top: 0.31, height: 0.32, font: 0.3 },
  number: { top: 0.63, height: 0.37, font: 0.36 },
} as const satisfies Record<string, LabelSlot>;
const TWO_LINE_SLOTS = {
  word: { top: 0.15, height: 0.38, font: 0.34 },
  number: { top: 0.53, height: 0.42, font: 0.4 },
} as const satisfies Record<string, LabelSlot>;
const LINE_HEIGHT_MULTIPLIER = 1.05;
const THREE_QUARTERS_FONT_SCALE = 0.9;
const THREE_QUARTERS_VERTICAL_OFFSET = 0.045;

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
  const { quarter: quarterIndex } = rubForHizbQuarter(rub);
  const typeStyle = {
    fontFamily: QURAN_FONT_FAMILY,
    color: quranBodyInk(quranTheme),
    textAlign: "center" as const,
    // Android pads each line by the font's own (very tall) metrics, which would
    // push the stack past the panel that the tight line heights below fit it to.
    includeFontPadding: false,
  };
  const panelHeight = height * ((panel?.b ?? 1) - (panel?.t ?? 0));
  const slotStyle = (slot: LabelSlot) => ({
    position: "absolute" as const,
    left: 0,
    right: 0,
    top: panelHeight * slot.top,
    height: panelHeight * slot.height,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  });
  const lineStyle = (slot: LabelSlot, fontScale = 1) => ({
    width: "100%" as const,
    fontSize: panelHeight * slot.font * fontScale,
    lineHeight: panelHeight * slot.font * fontScale * LINE_HEIGHT_MULTIPLIER,
  });
  const wordSlot = quarter ? THREE_LINE_SLOTS.word : TWO_LINE_SLOTS.word;
  const numberSlot = quarter ? THREE_LINE_SLOTS.number : TWO_LINE_SLOTS.number;
  const quarterOffset = quarterIndex === 3 ? panelHeight * THREE_QUARTERS_VERTICAL_OFFSET : 0;

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
      <View style={panelBox}>
        {/* allowFontScaling is off because the art can't grow with the OS font
            size — the type shrinks to the panel instead. Only the quarter line
            refits: it is the one that varies in length («ثلاث ارباع»). */}
        {quarter ? (
          <View
            style={{
              ...slotStyle(THREE_LINE_SLOTS.quarter),
              transform: [{ translateY: quarterOffset }],
            }}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              allowFontScaling={false}
              style={{
                ...typeStyle,
                ...lineStyle(
                  THREE_LINE_SLOTS.quarter,
                  quarterIndex === 3 ? THREE_QUARTERS_FONT_SCALE : 1
                ),
              }}>
              {quarter}
            </Text>
          </View>
        ) : null}
        <View style={slotStyle(wordSlot)}>
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={{ ...typeStyle, ...lineStyle(wordSlot) }}>
            {word}
          </Text>
        </View>
        <View style={slotStyle(numberSlot)}>
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={{ ...typeStyle, ...lineStyle(numberSlot) }}>
            {toHafsDigits(hizb)}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default HizbMedallion;
