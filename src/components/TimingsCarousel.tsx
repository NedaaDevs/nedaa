import * as React from "react";
import PagerView from "react-native-pager-view";

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

type Props = {
  mode: AppMode;
};

const TimingsCarousel = (props: Props) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const pagerRef = React.useRef<PagerView>(null);
  const selectionHaptic = useHaptic("selection");

  const handleTabPress = async (index: number) => {
    await selectionHaptic();
    pagerRef.current?.setPage(index);
    setCurrentIndex(index);
  };

  const handlePageSelected = async (event: any) => {
    const newIndex = event.nativeEvent.position;
    if (newIndex !== currentIndex) {
      await selectionHaptic();
      setCurrentIndex(newIndex);
    }
  };

  return (
    <Box flex={1} flexDirection="column">
      <Divider marginBottom="$2" />

      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={handlePageSelected}
        scrollEnabled={true}
        overdrag={true}>
        <Box key="prayer-times" flex={1}>
          <PrayerTimes />
        </Box>

        <Box key="other-timings" flex={1}>
          <OtherTimes />
        </Box>
      </PagerView>

      <Box position="absolute" bottom={0} left={0} right={0} backgroundColor="$backgroundSecondary">
        <CustomPagination data={data} onPress={handleTabPress} currentIndex={currentIndex} />
      </Box>
    </Box>
  );
};

export default TimingsCarousel;
