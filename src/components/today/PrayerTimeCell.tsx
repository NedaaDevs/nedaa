import type { ComponentProps } from "react";
import Animated from "react-native-reanimated";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type Props = {
  name: string;
  /** The time as drawn, in the reader's clock and digits. */
  time: string;
  /** Centres both lines in the cell. */
  centered?: boolean;
  /** Draws the time quiet, as while it loads. */
  muted?: boolean;
  /** A motion of the time alone, such as its fade. */
  timeStyle?: ComponentProps<typeof Animated.View>["style"];
  timeTestID?: string;
};

/** One prayer's name over its time, in a row of the day's times. */
export const PrayerTimeCell = ({
  name,
  time,
  centered = false,
  muted = false,
  timeStyle,
  timeTestID,
}: Props) => (
  <VStack flex={1} alignItems={centered ? "center" : undefined}>
    <Text size="xs" color="$mutedSky">
      {name}
    </Text>
    <Animated.View style={timeStyle}>
      <Text
        testID={timeTestID}
        size="sm"
        fontWeight="600"
        numeric
        color={muted ? "$mutedSky" : "$fg"}>
        {time}
      </Text>
    </Animated.View>
  </VStack>
);
