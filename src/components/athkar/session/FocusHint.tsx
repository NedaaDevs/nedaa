import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { ArrowDown, ArrowLeft, ArrowRight } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { FOCUS_GESTURE } from "@/constants/AthkarFocus";
import { DURATION_MS } from "@/constants/Motion";
import { useRTL } from "@/contexts/RTLContext";
import { useCountText } from "@/hooks/useRatioText";
import { LTR_ISOLATE } from "@/utils/digits";
import { nextSign } from "@/utils/focusGesture";

/** Test ids for the hint's parts. */
export const FOCUS_HINT_PART = {
  SIDES: "focus-hint-sides",
  GESTURES: "focus-hint-gestures",
} as const;

/** A count change as written: a sign, then the reader's digits. */
export const signedCount = (sign: "+" | "−", digits: string) =>
  `${LTR_ISOLATE.OPEN}${sign}${digits}${LTR_ISOLATE.CLOSE}`;

type Props = { visible: boolean };
type FadingProps = Props & { testID: string; children: ReactNode };

/** Fades its marks out; the accessibility actions speak for them. */
const Fading = ({ visible, testID, children }: FadingProps) => {
  const shown = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    shown.set(withTiming(visible ? 1 : 0, { duration: DURATION_MS.SETTLE }));
  }, [visible, shown]);
  const style = useAnimatedStyle(() => ({ opacity: shown.get() }));
  return (
    <Animated.View testID={testID} {...HIDDEN_FROM_READER} pointerEvents="none" style={style}>
      {children}
    </Animated.View>
  );
};

const Word = ({ children }: { children: string }) => (
  <Text size="helper" fontWeight="500" color="$muted">
    {children}
  </Text>
);

/** Next and previous, each at the side its drag moves toward. */
export const FocusSideMarks = ({ visible }: Props) => {
  const { t } = useTranslation();
  const { isRTL } = useRTL();
  const [toNext, toPrevious] =
    nextSign(isRTL) > 0 ? [ArrowRight, ArrowLeft] : [ArrowLeft, ArrowRight];
  return (
    <Fading visible={visible} testID={FOCUS_HINT_PART.SIDES}>
      <HStack justifyContent="space-between" alignItems="center">
        <HStack alignItems="center" gap="$1.5">
          <Icon as={toNext} size="xs" color="$muted" />
          <Word>{t("athkar.focus.next")}</Word>
        </HStack>
        <HStack alignItems="center" gap="$1.5">
          <Word>{t("athkar.audio.previous")}</Word>
          <Icon as={toPrevious} size="xs" color="$muted" />
        </HStack>
      </HStack>
    </Fading>
  );
};

const Dot = ({ ringed = false }: { ringed?: boolean }) => (
  <Box
    alignItems="center"
    justifyContent="center"
    width="$3.5"
    height="$3.5"
    borderRadius="$pill"
    borderWidth={ringed ? 1.5 : 0}
    borderColor="$accent">
    <Box width="$2" height="$2" borderRadius="$pill" backgroundColor="$accent" />
  </Box>
);

/** The tap, the hold and the undo, on the line under the count. */
export const FocusGestureMarks = ({ visible }: Props) => {
  const { t } = useTranslation();
  const countText = useCountText();
  return (
    <Fading visible={visible} testID={FOCUS_HINT_PART.GESTURES}>
      <HStack
        alignItems="center"
        justifyContent="center"
        flexWrap="wrap"
        columnGap="$3.5"
        rowGap="$1">
        <HStack alignItems="center" gap="$1.5">
          <Dot />
          <Word>{t("athkar.focus.hint.tap")}</Word>
          <Word>{signedCount("+", countText(1))}</Word>
        </HStack>
        <HStack alignItems="center" gap="$1.5">
          <Dot ringed />
          <Word>{t("athkar.focus.hint.hold")}</Word>
          <Word>{signedCount("+", countText(FOCUS_GESTURE.HOLD_ADD))}</Word>
        </HStack>
        <HStack alignItems="center" gap="$1.5">
          <Icon as={ArrowDown} size="xs" color="$muted" />
          <Word>{t("athkar.session.undo")}</Word>
        </HStack>
      </HStack>
    </Fading>
  );
};
