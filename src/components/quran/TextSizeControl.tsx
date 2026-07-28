import { StyleSheet, View } from "react-native";
import { MotiView } from "moti";

import { QURAN_THEME_COLORS, quranBodyInk } from "@/constants/Quran";
import { QuranThemeType } from "@/enums/quran";
import FontSizeControls from "@/components/quran/FontSizeControls";

interface TextSizeControlProps {
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  quranTheme: QuranThemeType;
  visible: boolean;
}

// Reading-size stepper for text mode. Follows the reader chrome via `visible`,
// plus a grace window on entry so the control announces itself once without
// standing over the page for the whole session.
const TextSizeControl = ({
  fontSize,
  onFontSizeChange,
  quranTheme,
  visible,
}: TextSizeControlProps) => {
  const themeColors = QURAN_THEME_COLORS[quranTheme];

  return (
    <MotiView
      animate={{ opacity: visible ? 1 : 0, translateY: visible ? 0 : 8 }}
      transition={{ type: "timing", duration: 180 }}
      pointerEvents={visible ? "auto" : "none"}>
      <View
        style={[
          styles.pill,
          { backgroundColor: themeColors.innerBackground, borderColor: themeColors.frameColor },
        ]}>
        <FontSizeControls
          fontSize={fontSize}
          onFontSizeChange={onFontSizeChange}
          color={quranBodyInk(quranTheme)}
          vertical
        />
      </View>
    </MotiView>
  );
};

const styles = StyleSheet.create({
  pill: {
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
});

export default TextSizeControl;
