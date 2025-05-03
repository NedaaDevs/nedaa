import * as React from "react";
import { Dimensions, useColorScheme } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import Carousel, { ICarouselInstance, Pagination } from "react-native-reanimated-carousel";

// Components
import { Box } from "@/components/ui/box";
import PrayerTimes from "@/components/PrayerTimesList";
import OtherTimes from "@/components/OtherTimingsList";

// Hooks
import { useHaptic } from "@/hooks/useHaptic";
import { AppMode } from "@/enums/app";

const data = [PrayerTimes, OtherTimes];
const width = Dimensions.get("window").width;

type Props = {
  mode: AppMode;
};

const TimingsCarousel = (props: Props) => {
  const ref = React.useRef<ICarouselInstance>(null);
  const progress = useSharedValue<number>(0);

  const selectionHaptic = useHaptic("selection");
  const colorScheme = useColorScheme();

  const onPressPagination = async (index: number) => {
    ref.current?.scrollTo({
      count: index - progress.value,
      animated: true,
    });
  };

  const handleSnap = async () => {
    await selectionHaptic();
  };

  const getMode = (mode: AppMode) => {
    if (mode === "system") {
      return colorScheme ?? "light";
    }

    return mode;
  };

  const getActiveBackgroundColor = () => {
    const mode = getMode(props.mode);

    return mode === AppMode.DARK ? "#e5cb87" : "#1e3c5a";
  };

  return (
    <Box style={{ flex: 1 }}>
      <Carousel
        ref={ref}
        width={width}
        height={width}
        data={data}
        onProgressChange={progress}
        onSnapToItem={handleSnap}
        renderItem={({ item: Component }) => <Component />}
      />

      <Box style={{ marginTop: "auto", paddingBottom: 20 }}>
        <Pagination.Basic
          progress={progress}
          data={data}
          dotStyle={{ backgroundColor: "#ffffff", borderRadius: 50 }}
          activeDotStyle={{
            backgroundColor: getActiveBackgroundColor(),
          }}
          containerStyle={{ gap: 5 }}
          onPress={onPressPagination}
        />
      </Box>
    </Box>
  );
};

export default TimingsCarousel;
