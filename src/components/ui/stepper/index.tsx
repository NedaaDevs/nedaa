import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { type AccessibilityActionEvent } from "react-native";
import { Minus, Plus } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { usePressRetention } from "@/components/ui/pressable/retention";
import { A11Y_ACTION, adjustActions, HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { useHaptic } from "@/hooks/useHaptic";

/** Repeat delays while held: slow at first, faster once the hold is clearly deliberate. */
export const REPEAT = { SLOW_MS: 200, FAST_MS: 100, SLOW_STEPS: 5 } as const;

/** Test ids for the two buttons, which the screen reader does not see. */
export const STEPPER_PART = {
  DECREMENT: "stepper-decrement",
  INCREMENT: "stepper-increment",
} as const;

const DIRECTION = { DOWN: -1, UP: 1 } as const;
type Direction = (typeof DIRECTION)[keyof typeof DIRECTION];

type Props = {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  /** Names the value for the screen reader. */
  accessibilityLabel: string;
  /** The value as a screen reader should say it, e.g. "5 days". */
  valueText: string;
  disabled?: boolean;
  /** The value as drawn between the buttons. */
  children: ReactNode;
};

export const Stepper = ({
  value,
  onChange,
  min,
  max,
  accessibilityLabel,
  valueText,
  disabled,
  children,
}: Props) => {
  const [held, setHeld] = useState<Direction | null>(null);
  const haptic = useHaptic("light");
  const retention = usePressRetention(() => setHeld(null));

  // Returns where it landed, so a hold counts on from there without waiting for a render.
  const advance = (from: number, direction: Direction) => {
    const next = Math.min(max, Math.max(min, from + direction));
    if (next !== from) onChange(next);
    return next;
  };
  const advanceHeld = useEffectEvent(advance);
  const currentValue = useEffectEvent(() => value);

  useEffect(() => {
    if (held === null || disabled) return;
    let current = advanceHeld(currentValue(), held);
    let repeats = 0;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          current = advanceHeld(current, held);
          repeats += 1;
          schedule();
        },
        repeats < REPEAT.SLOW_STEPS ? REPEAT.SLOW_MS : REPEAT.FAST_MS
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, [held, disabled]);

  const handleAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    if (disabled) return;
    if (nativeEvent.actionName === A11Y_ACTION.INCREMENT) advance(value, DIRECTION.UP);
    if (nativeEvent.actionName === A11Y_ACTION.DECREMENT) advance(value, DIRECTION.DOWN);
  };

  // Press-in is gated, press-out never is, so a hold always ends with the finger.
  const button = (direction: Direction, glyph: typeof Minus, testID: string) => (
    <Pressable
      {...HIDDEN_FROM_READER}
      testID={testID}
      onPressIn={
        disabled
          ? undefined
          : () => {
              haptic();
              setHeld(direction);
            }
      }
      onPressOut={() => setHeld(null)}
      {...retention}
      opacity={disabled ? 0.4 : 1}
      backgroundColor="$accentSoft"
      borderRadius="$chip"
      alignItems="center"
      justifyContent="center">
      <Box pointerEvents="none">
        <Icon as={glyph} size="md" color="$accent" />
      </Box>
    </Pressable>
  );

  return (
    <HStack
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: valueText }}
      accessibilityActions={adjustActions()}
      onAccessibilityAction={handleAccessibilityAction}
      accessibilityState={{ disabled: Boolean(disabled) }}
      alignItems="center"
      spacing="stack"
      pad="inline"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$control">
      {button(DIRECTION.DOWN, Minus, STEPPER_PART.DECREMENT)}
      <Box flex={1} alignItems="center">
        {children}
      </Box>
      {button(DIRECTION.UP, Plus, STEPPER_PART.INCREMENT)}
    </HStack>
  );
};
