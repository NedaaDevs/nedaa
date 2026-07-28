import { StyleSheet, View } from "react-native";

import { QURAN_THEME_COLORS, quranBodyInk } from "@/constants/Quran";
import { QuranThemeType } from "@/enums/quran";
import FontSizeControls from "@/components/quran/FontSizeControls";

interface TextSizeControlProps {
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  quranTheme: QuranThemeType;
}

// Always-on reading-size stepper for text mode. It sits outside the auto-hiding
// chrome so the control is there whenever the text is, which is what a reader
// who needs a larger size depends on.
const TextSizeControl = ({ fontSize, onFontSizeChange, quranTheme }: TextSizeControlProps) => {
  const themeColors = QURAN_THEME_COLORS[quranTheme];

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: themeColors.innerBackground, borderColor: themeColors.frameColor },
      ]}>
      <FontSizeControls
        fontSize={fontSize}
        onFontSizeChange={onFontSizeChange}
        color={quranBodyInk(quranTheme)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
});

export default TextSizeControl;
