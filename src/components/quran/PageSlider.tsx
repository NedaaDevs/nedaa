import { useCallback } from "react";
import { XStack } from "tamagui";
import { Slider } from "@tamagui/slider";

import { Text } from "@/components/ui/text";
import { QuranTheme } from "@/enums/quran";
import { TOTAL_PAGES, QURAN_THEME_COLORS, QURAN_UI_COLORS } from "@/constants/Quran";

interface PageSliderProps {
  currentPage: number;
  quranTheme: QuranTheme;
  onPageChange: (page: number) => void;
}

const PageSlider = ({ currentPage, quranTheme, onPageChange }: PageSliderProps) => {
  const themeColors = QURAN_THEME_COLORS[quranTheme];
  const isDark = quranTheme === QuranTheme.DARK;

  const trackColor = isDark ? "rgba(255,255,255,0.1)" : QURAN_UI_COLORS.progressTrack;

  const handleValueChange = useCallback(
    (value: number[]) => {
      const page = Math.round(value[0]);
      if (page !== currentPage) {
        onPageChange(page);
      }
    },
    [currentPage, onPageChange]
  );

  return (
    <XStack alignItems="center" paddingHorizontal="$4" gap="$2">
      <Slider
        dir="rtl"
        flex={1}
        min={1}
        max={TOTAL_PAGES}
        step={1}
        value={[currentPage]}
        onValueChange={handleValueChange}
        size="$3"
        accessibilityRole="adjustable"
        accessibilityLabel={`Page ${currentPage} of ${TOTAL_PAGES}`}>
        <Slider.Track backgroundColor={trackColor} height={36} borderRadius={18}>
          <Slider.TrackActive backgroundColor={themeColors.markerColor} borderRadius={18} />
        </Slider.Track>
        <Slider.Thumb
          index={0}
          circular
          size="$3"
          backgroundColor={themeColors.markerColor}
          borderWidth={0}
        />
      </Slider>
      <Text
        color={themeColors.pageNumberColor}
        fontSize={13}
        fontWeight="600"
        width={30}
        textAlign="center">
        {String(currentPage)}
      </Text>
    </XStack>
  );
};

export default PageSlider;
