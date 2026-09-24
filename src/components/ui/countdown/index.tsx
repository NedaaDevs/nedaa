import { useEffect, useRef, useState, type ComponentProps } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/ui/text";
import { SPIN } from "@/constants/Countdown";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Test ids; the figure is drawing, hidden from the screen reader. */
export const COUNTDOWN_PART = {
  ROW: "countdown-row",
  SIZER: "countdown-sizer",
  SHAPE: "countdown-shape",
  REEL: "countdown-reel",
  GLYPH: "countdown-glyph",
} as const;

/** Which way a figure's reels turn on a tick. */
export const COUNT_DIRECTION = { UP: "up", DOWN: "down" } as const;

export type CountDirection = (typeof COUNT_DIRECTION)[keyof typeof COUNT_DIRECTION];

/** A tick's glide, and a label's roll: short and small. */
export const COUNTDOWN = { tickMs: 600, rollMs: 200, rise: 8 } as const;

type TextProps = Omit<ComponentProps<typeof Text>, "children">;

/** The digits of each script a figure may use: Latin, Arabic, Persian, Urdu. */
const DIGIT_SETS = ["0123456789", "٠١٢٣٤٥٦٧٨٩", "۰۱۲۳۴۵۶۷۸۹"] as const;
const TURN = 10;

// Gentle at both ends, so a tick glides and the digit then rests to be read.
const GLIDE = { duration: COUNTDOWN.tickMs, easing: Easing.inOut(Easing.cubic) };
// Underdamped, so a whirl lands a little past its place and bounces back.
const BOUNCE = { damping: 13, stiffness: 220, mass: 0.7 };
const WHIRL = { duration: SPIN.ms, easing: Easing.out(Easing.cubic) };
/** How far past its digit a whirl runs before it bounces back, in digits. */
const WHIRL_OVERSHOOT = 0.3;

const HIDDEN = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
} as const;

/** Steps a reel turns from one digit to the next, the way the figure counts. */
export const reelStep = (from: number, to: number, direction: CountDirection) =>
  direction === COUNT_DIRECTION.UP ? (to - from + TURN) % TURN : -((from - to + TURN) % TURN);

/** Every digit of its script in a column, which is as wide as the widest. */
const Sizer = ({ digits, textProps }: { digits: string; textProps: TextProps }) => (
  <View testID={COUNTDOWN_PART.SIZER} {...HIDDEN} style={styles.sizer}>
    {[...digits].map((digit) => (
      <Text key={digit} {...textProps}>
        {digit}
      </Text>
    ))}
  </View>
);

/** A character that never moves: a separator, or the reserve's hidden copy. */
const Still = ({ text, textProps }: { text: string; textProps: TextProps }) => {
  const digits = DIGIT_SETS.find((set) => set.includes(text));
  return (
    <View style={styles.slot}>
      {digits && <Sizer digits={digits} textProps={textProps} />}
      <Text {...textProps}>{text}</Text>
    </View>
  );
};

type ReelProps = {
  digit: string;
  digits: string;
  textProps: TextProps;
  direction: CountDirection;
  openKey: number;
  switchKey: string;
};

type Aim = { target: number; index: number; openKey?: number; switchKey?: string };

/** A window over three turns of digits; the strip slides to the digit shown. */
const Reel = ({ digit, digits, textProps, direction, openKey, switchKey }: ReelProps) => {
  const reduced = useReducedMotion();
  const index = digits.indexOf(digit);
  const [line, setLine] = useState(0);
  const position = useSharedValue(reduced ? index : 0);
  // Where the reel last aimed; with no open seen yet, the first effect whirls.
  const last = useRef<Aim>({ target: 0, index: 0 });

  useEffect(() => {
    const seen = last.current;
    const opened = seen.openKey !== openKey;
    const switched = !opened && seen.switchKey !== switchKey;
    const turn = direction === COUNT_DIRECTION.UP ? TURN : -TURN;

    let target = seen.target + reelStep(seen.index, index, direction);
    if (opened) target = reelStep(0, index, COUNT_DIRECTION.UP) + TURN;
    else if (switched) target += turn;
    last.current = { target, index, openKey, switchKey };

    // A whirl runs a fixed distance past the digit, however far it travelled.
    const start = opened ? 0 : seen.target;
    const past = target + Math.sign(target - start) * WHIRL_OVERSHOOT;
    const whirl = () => withSequence(withTiming(past, WHIRL), withSpring(target, BOUNCE));

    if (reduced) position.set(target);
    else if (opened) {
      position.set(0);
      position.set(whirl());
    } else if (switched) position.set(whirl());
    else if (target !== seen.target) position.set(withTiming(target, GLIDE));
  }, [index, openKey, switchKey, direction, reduced, position]);

  const strip = useAnimatedStyle(() => {
    // The strip repeats every turn, so wrapping the position shows no seam.
    const wrapped = ((position.get() % TURN) + TURN) % TURN;
    return { transform: [{ translateY: -(wrapped + TURN) * line }] };
  });

  return (
    <View style={styles.slot}>
      <Sizer digits={digits} textProps={textProps} />
      <View
        testID={COUNTDOWN_PART.SHAPE}
        {...HIDDEN}
        style={styles.hiddenCopy}
        onLayout={({ nativeEvent }: LayoutChangeEvent) => setLine(nativeEvent.layout.height)}>
        <Text {...textProps}>{digit}</Text>
      </View>
      <Animated.View testID={COUNTDOWN_PART.REEL} {...HIDDEN} style={[styles.strip, strip]}>
        {[...digits.repeat(3)].map((reelDigit, i) => (
          <Text key={i} {...textProps}>
            {reelDigit}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
};

type CountdownProps = TextProps & {
  value: string;
  /** The widest value it shows, held as its width so nothing beside it moves. */
  reserve: string;
  /** Which way the reels turn on a tick. */
  counting: CountDirection;
  /** A new value whirls the reels up from zero, as when the screen opens. */
  openKey: number;
  /** A new value whirls the reels from where they stand to the new figure. */
  switchKey: string;
};

/** A figure on digit reels that slide to each new value, in tabular figures. */
export const Countdown = ({
  value,
  reserve,
  counting,
  openKey,
  switchKey,
  ...textProps
}: CountdownProps) => {
  const figures = { ...textProps, numeric: true, glyph: true };
  const characters = [...value];

  return (
    <View>
      <View {...HIDDEN} style={styles.reserve}>
        {[...reserve].map((character, i) => (
          <Still key={i} text={character} textProps={figures} />
        ))}
      </View>
      {/* Figures read left to right in every language. */}
      <View testID={COUNTDOWN_PART.ROW} style={styles.row}>
        {characters.map((character, i) => {
          const digits = DIGIT_SETS.find((set) => set.includes(character));
          // Keyed from the end, so 10:00 to 9:59 turns each place against itself.
          const key = characters.length - i;
          return digits ? (
            <Reel
              key={key}
              digit={character}
              digits={digits}
              textProps={figures}
              direction={counting}
              openKey={openKey}
              switchKey={switchKey}
            />
          ) : (
            <Still key={key} text={character} textProps={figures} />
          );
        })}
      </View>
    </View>
  );
};

const TIMING = { duration: COUNTDOWN.rollMs, easing: Easing.out(Easing.cubic) };

/** The new label rises into place as the old one rises out. */
const rollIn = () => {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ translateY: COUNTDOWN.rise }] },
    animations: {
      opacity: withTiming(1, TIMING),
      transform: [{ translateY: withTiming(0, TIMING) }],
    },
  };
};

const rollOut = () => {
  "worklet";
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
    animations: {
      opacity: withTiming(0, TIMING),
      transform: [{ translateY: withTiming(-COUNTDOWN.rise, TIMING) }],
    },
  };
};

/** A label that rolls as one piece when its text changes. */
export const Rolling = ({ value, ...textProps }: TextProps & { value: string }) => {
  // Reduce Motion holds a layout animation at its start; it must get none.
  const animate = !useReducedMotion();
  return (
    <View style={styles.slot}>
      <Text {...textProps} {...HIDDEN} style={styles.hiddenCopy}>
        {value}
      </Text>
      <Animated.View
        key={value}
        testID={COUNTDOWN_PART.GLYPH}
        {...HIDDEN}
        entering={animate ? rollIn : undefined}
        exiting={animate ? rollOut : undefined}
        style={styles.glyph}>
        <Text {...textProps}>{value}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  slot: { alignItems: "center", overflow: "hidden" },
  // As wide as its widest digit, and no height, so it sizes only the width.
  sizer: { height: 0, overflow: "hidden" },
  hiddenCopy: { opacity: 0 },
  strip: { position: "absolute", top: 0, start: 0, end: 0, alignItems: "center" },
  glyph: { ...StyleSheet.absoluteFill, alignItems: "center" },
  reserve: { flexDirection: "row", direction: "ltr", opacity: 0 },
  row: {
    ...StyleSheet.absoluteFill,
    direction: "ltr",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
});
