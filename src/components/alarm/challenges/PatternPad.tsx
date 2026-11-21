import { X } from "lucide-react-native";
import { StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { useTranslation } from "react-i18next";

import { CardMark } from "@/components/alarm/challenges/AnswerCard";
import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { usePressScale } from "@/components/ui/pressable/pressScale";
import { useThemeColor } from "@/components/ui/theme-color";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import {
  PATTERN_PAD,
  PATTERN_PAD_FILLS,
  PATTERN_PAD_SIZE,
  PATTERN_PAD_STATE,
  PATTERN_PART,
  PATTERN_SHAPE_VIEWBOX,
  PATTERN_TIMING,
  type PatternPad as Pad,
  type PatternPadState,
} from "@/constants/WakeTaskBoards";

type Props = {
  pad: Pad;
  /** What a screen reader calls the pad: its shape and its place. */
  spoken: string;
  state: PatternPadState;
  /** Off under Reduce Motion: the fill switches on and off instead. */
  fades: boolean;
  onPress: () => void;
};

/** One pad's shape, on the 24-unit square both builds draw. */
const Shape = ({ pad, ink, filled }: { pad: Pad; ink: string; filled: boolean }) => {
  const fill = filled && PATTERN_PAD_FILLS[pad] ? ink : "none";
  const stroke = {
    stroke: ink,
    strokeWidth: PATTERN_PAD_SIZE.STROKE,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  const shape = () => {
    switch (pad) {
      case PATTERN_PAD.CIRCLE:
        return <Circle cx={12} cy={12} r={7.5} fill={fill} {...stroke} />;
      case PATTERN_PAD.TRIANGLE:
        return <Path d="M12 4.5L20 18.5H4z" fill={fill} {...stroke} />;
      case PATTERN_PAD.SQUARE:
        return (
          <Path
            d="M6.5 5h11a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17.5v-11A1.5 1.5 0 0 1 6.5 5z"
            fill={fill}
            {...stroke}
          />
        );
      case PATTERN_PAD.LINES:
        return <Path d="M5 9h14M5 15h14" fill="none" {...stroke} />;
      default: {
        const unhandled: never = pad;
        throw new Error(`unhandled pattern pad: ${String(unhandled)}`);
      }
    }
  };
  return (
    <Svg
      width={PATTERN_PAD_SIZE.SHAPE}
      height={PATTERN_PAD_SIZE.SHAPE}
      viewBox={PATTERN_SHAPE_VIEWBOX}
      {...HIDDEN_FROM_READER}>
      {shape()}
    </Svg>
  );
};

/** One of the pattern board's four pads; only a pad at rest takes a tap. */
const PatternPad = ({ pad, spoken, state, fades, onPress }: Props) => {
  const { t } = useTranslation();
  const press = usePressScale();
  const fg = useThemeColor("$fg");
  const onAccent = useThemeColor("$bg");
  const lit = state === PATTERN_PAD_STATE.LIT;
  const wrong = state === PATTERN_PAD_STATE.WRONG;
  const still = state !== PATTERN_PAD_STATE.REST;

  return (
    <Pressable
      testID={PATTERN_PART.PAD}
      accessibilityLabel={wrong ? t("a11y.alarm.task.cardWrong", { card: spoken }) : spoken}
      // Marked by its border, fill and badge; `disabled` would fade it.
      accessibilityState={{ disabled: still }}
      onPress={still ? undefined : onPress}
      height={PATTERN_PAD_SIZE.HEIGHT}
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      borderRadius="$card"
      borderWidth={lit ? 3 : wrong ? 2 : 1.5}
      borderStyle={wrong ? "dashed" : "solid"}
      borderColor={lit ? "$accent" : wrong ? "$danger" : "$hairline"}
      backgroundColor="$surface"
      transition={press.transition}
      animateOnly={press.animateOnly}
      pressStyle={
        still
          ? { opacity: 1 }
          : {
              ...press.pressStyle,
              opacity: 1,
              backgroundColor: "$pressed",
              borderColor: "$fg",
              borderWidth: 2.5,
            }
      }>
      {lit && (
        <Animated.View
          style={StyleSheet.absoluteFill}
          entering={fades ? FadeIn.duration(PATTERN_TIMING.FADE) : undefined}
          exiting={fades ? FadeOut.duration(PATTERN_TIMING.FADE) : undefined}>
          <Box testID={PATTERN_PART.PAD_FILL} flex={1} backgroundColor="$accent" />
        </Animated.View>
      )}
      <Shape pad={pad} ink={lit ? onAccent : fg} filled={lit} />
      {wrong && (
        <CardMark tone="$danger">
          <Icon as={X} size="sm" color="$danger" />
        </CardMark>
      )}
    </Pressable>
  );
};

export default PatternPad;
