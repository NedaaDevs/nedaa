import * as React from "react";
import { Dimensions, useColorScheme, I18nManager } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import Carousel, { ICarouselInstance } from "react-native-reanimated-carousel";

// Components
import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import PrayerTimes from "@/components/PrayerTimesList";
import OtherTimes from "@/components/OtherTimingsList";
import CustomPagination from "@/components/CustomPagination";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";
import { AppMode } from "@/enums/app";

const data = [PrayerTimes, OtherTimes];
const { width } = Dimensions.get("window");

type Props = {
  mode: AppMode;
};

const TimingsCarousel = (props: Props) => {
  const ref = React.useRef<ICarouselInstance>(null);
  const progress = useSharedValue<number>(0);
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const selectionHaptic = useHaptic("selection");
  const colorScheme = useColorScheme();
  const isRTL = I18nManager.isRTL;

  const onPressPagination = async (index: number) => {
    ref.current?.scrollTo({
      count: index - progress.value,
      animated: true,
    });
  };

  const handleSnap = async (index: number) => {
    await selectionHaptic();
    setCurrentIndex(index);
  };

  const getMode = (mode: AppMode) => {
    if (mode === "system") {
      return colorScheme ?? "light";
    }
    return mode;
  };

  const isDarkMode = getMode(props.mode) === AppMode.DARK;

  return (
    <Box style={{ flex: 1, flexDirection: "column" }}>
      <Divider className="mb-2" />
      <Box style={{ flex: 1, marginBottom: 80 }}>
        <Carousel
          ref={ref}
          width={width}
          data={data}
          loop={false} // Disable circular navigation
          onProgressChange={progress}
          onSnapToItem={handleSnap}
          renderItem={({ item: Component }) => (
            <Box style={{ flex: 1, width: width }}>
              <Component />
            </Box>
          )}
          enabled={true}
          // Prevent swiping past boundaries based on locale
          onScrollEnd={() => {
            if (isRTL) {
              // RTL: Can only go from 0 -> 1 (right swipe) and 1 -> 0 (left swipe)
              if (currentIndex === 0 && progress.value < 0) {
                ref.current?.scrollTo({ index: 0, animated: true });
              } else if (currentIndex === 1 && progress.value > 1) {
                ref.current?.scrollTo({ index: 1, animated: true });
              }
            } else {
              // LTR: Can only go from 0 -> 1 (left swipe) and 1 -> 0 (right swipe)
              if (currentIndex === 0 && progress.value < 0) {
                ref.current?.scrollTo({ index: 0, animated: true });
              } else if (currentIndex === 1 && progress.value > 1) {
                ref.current?.scrollTo({ index: 1, animated: true });
              }
            }
          }}
        />
      </Box>

      <Box
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: isDarkMode ? "#1e3c5a" : "#ffffff",
        }}>
        <CustomPagination
          progress={progress}
          data={data}
          onPress={onPressPagination}
          isDarkMode={isDarkMode}
          currentIndex={currentIndex}
          variant="lines"
        />
      </Box>
    </Box>
  );
};

export default TimingsCarousel;
