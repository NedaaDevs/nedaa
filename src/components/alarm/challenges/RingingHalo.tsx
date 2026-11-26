import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Box } from "@/components/ui/box";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { RINGING_HALO, RINGING_PART } from "@/constants/AlarmRinging";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const BREATH = { duration: RINGING_HALO.BREATH_MS / 2, easing: Easing.inOut(Easing.ease) };

/** A thin ring behind the time; it breathes while the alarm sounds. */
const RingingHalo = ({ breathing }: { breathing: boolean }) => {
  const reduced = useReducedMotion();
  const moving = breathing && !reduced;
  const breath = useSharedValue(0);

  useEffect(() => {
    if (!moving) return;
    breath.set(withRepeat(withTiming(1, BREATH), -1, true));
    return () => {
      cancelAnimation(breath);
      breath.set(0);
    };
  }, [moving, breath]);

  const style = useAnimatedStyle(() => {
    const at = breath.get();
    return {
      opacity: interpolate(at, [0, 1], [RINGING_HALO.REST_OPACITY, RINGING_HALO.LOW_OPACITY]),
      transform: [{ scale: interpolate(at, [0, 1], [1, RINGING_HALO.SCALE]) }],
    };
  });

  return (
    <View pointerEvents="none" style={styles.layer} {...HIDDEN_FROM_READER}>
      <Animated.View testID={RINGING_PART.HALO} style={[styles.ring, style]}>
        <Box flex={1} borderRadius="$pill" borderWidth={RINGING_HALO.RING} borderColor="$accent" />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  ring: { width: RINGING_HALO.SIZE, height: RINGING_HALO.SIZE },
});

export default RingingHalo;
