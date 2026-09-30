import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Heart } from "lucide-react-native";

import { Icon, type IconProps } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** CSS `ease` and `ease-out`, the curves the Settings design names. */
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

// Opacity and scale run on their own clocks, as the design draws them.
const FADE = { duration: 180, easing: EASE };
const GROW = { duration: 220, easing: EASE };
/** The heart swells past its size, then settles: 620ms in all. */
const POP = [
  { to: 1.22, duration: 341 },
  { to: 1, duration: 279 },
] as const;
const POP_FROM = 0.55;
const MAIN_SHRINK = 0.18;
const THANKS_FROM = 0.72;
const GLYPH_STROKE = 1.7;

type Ink = "$accent" | "$warn";

/** `$warn` clears only the 3:1 floor for glyphs, so its label takes `$fg`. */
const LABEL_INK: Record<Ink, "$accent" | "$fg"> = { $accent: "$accent", $warn: "$fg" };

type Props = {
  icon: IconProps["as"];
  /** The glyph's colour, and the label's where it holds text contrast. */
  ink: Ink;
  label: string;
  thanksLabel: string;
  thanked: boolean;
  hint: string;
  onPress: () => void;
  onLongPress?: () => void;
};

/** An action that turns to a thank-you in place, then back. */
export const SupportTile = ({
  icon,
  ink,
  label,
  thanksLabel,
  thanked,
  hint,
  onPress,
  onLongPress,
}: Props) => {
  const reduced = useReducedMotion();
  const fade = useSharedValue(0);
  const grow = useSharedValue(0);
  const heart = useSharedValue(1);

  useEffect(() => {
    const target = thanked ? 1 : 0;
    if (reduced) {
      fade.set(target);
      grow.set(target);
      heart.set(1);
      return;
    }
    fade.set(withTiming(target, FADE));
    grow.set(withTiming(target, GROW));
    if (!thanked) return;
    heart.set(POP_FROM);
    heart.set(
      withSequence(...POP.map(({ to, duration }) => withTiming(to, { duration, easing: EASE_OUT })))
    );
  }, [thanked, reduced, fade, grow, heart]);

  const main = useAnimatedStyle(() => ({
    opacity: 1 - fade.get(),
    transform: [{ scale: 1 - MAIN_SHRINK * grow.get() }],
  }));
  const thanks = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: [{ scale: THANKS_FROM + (1 - THANKS_FROM) * grow.get() }],
  }));
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: heart.get() }] }));

  return (
    <Pressable
      onPress={thanked ? undefined : onPress}
      onLongPress={thanked ? undefined : onLongPress}
      accessibilityLabel={thanked ? thanksLabel : label}
      accessibilityHint={thanked ? undefined : hint}
      minHeight="$24"
      paddingVertical="$2.5"
      paddingHorizontal="$1.5"
      alignItems="center"
      justifyContent="center"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$control"
      backgroundColor="$surface2"
      pressStyle={{ backgroundColor: "$tile" }}
      overflow="hidden">
      {/* The action sets the tile's size; the thanks lies over it. */}
      <Animated.View style={main}>
        <VStack alignItems="center" gap="$1">
          <Icon as={icon} size="xl" color={ink} strokeWidth={GLYPH_STROKE} />
          <Text size="sm" bold typography="title" color={LABEL_INK[ink]} textAlign="center">
            {label}
          </Text>
        </VStack>
      </Animated.View>
      <Animated.View style={[styles.over, thanks]}>
        <VStack alignItems="center" gap="$1">
          <Animated.View style={pop}>
            <Icon as={Heart} size="xl" color="$danger" fill="$danger" strokeWidth={GLYPH_STROKE} />
          </Animated.View>
          <Text size="sm" bold typography="title" color="$danger" textAlign="center">
            {thanksLabel}
          </Text>
        </VStack>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  over: {
    position: "absolute",
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
