import { useEffect } from "react";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type Props = {
  holding: boolean;
  durationMs: number;
  color: string;
};

/** Grows from the start edge across the hold, and snaps back when the hold ends. */
export const Fill = ({ holding, durationMs, color }: Props) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (holding) {
      // The fill shows how long is left, so it runs under Reduce Motion too.
      progress.set(
        withTiming(1, {
          duration: durationMs,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.Never,
        })
      );
      return;
    }
    cancelAnimation(progress);
    progress.set(0);
  }, [holding, durationMs, progress]);

  const width = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", top: 0, bottom: 0, start: 0, backgroundColor: color, opacity: 0.2 },
        width,
      ]}
    />
  );
};
