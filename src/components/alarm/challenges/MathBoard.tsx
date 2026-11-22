import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { ViewInstance } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import AnswerCard from "@/components/alarm/challenges/AnswerCard";
import type { BoardProps } from "@/components/alarm/challenges/taskBoards";
import { Box } from "@/components/ui/box";
import { Grid } from "@/components/ui/grid";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import {
  ANSWER_CARD_KIND,
  ANSWER_CARD_PLACE_KEY,
  ANSWER_CARD_POSITIONS,
  BOARD_PART,
  BOARD_TYPE,
  BOARD_SWAP_MS,
  MATH_LINE_KEY,
  MATH_SPOKEN_KEY,
  MATH_SYMBOL,
  MATH_TAP,
  WRONG_CARD_HOLD_MS,
  type AnswerCardPosition,
} from "@/constants/WakeTaskBoards";
import { useHaptic } from "@/hooks/useHaptic";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { focusOn } from "@/utils/accessibilityFocus";
import { LTR_ISOLATE } from "@/utils/digits";
import {
  cardStateOf,
  mathLineOf,
  replaceQuestion,
  startMathBoard,
  tapMathCard,
} from "@/utils/mathBoard";
import { formatNumberToLocale } from "@/utils/number";
import type { Rng } from "@/utils/rng";

type Props = BoardProps & {
  /** Draws each question; tests pass a seeded one. */
  rng?: Rng;
};

const formatted = (value: number) => formatNumberToLocale(String(value));

/** A sum and four answer cards; a wrong card swaps in a new sum. */
const MathBoard = ({ difficulty, onComplete, rng = Math.random }: Props) => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const hapticSuccess = useHaptic(HAPTIC_FEEDBACK.SUCCESS);
  const hapticError = useHaptic(HAPTIC_FEEDBACK.ERROR);
  const [board, setBoard] = useState(() => startMathBoard(difficulty, rng));
  const { round, asked, wrong } = board;
  const sumRef = useRef<ViewInstance>(null);

  const replace = useEffectEvent(() => setBoard(replaceQuestion(board, difficulty, rng)));

  useEffect(() => {
    if (wrong === null) return;
    const id = setTimeout(replace, WRONG_CARD_HOLD_MS);
    return () => clearTimeout(id);
  }, [wrong]);

  // Reader focus follows each new question after the first.
  useEffect(() => {
    if (asked > 0) focusOn(sumRef.current);
  }, [asked]);

  const choose = (position: AnswerCardPosition) => {
    const tap = tapMathCard(board, position);
    if (tap.outcome === MATH_TAP.IGNORED) return;
    setBoard(tap.state);
    if (tap.outcome === MATH_TAP.SOLVED) {
      hapticSuccess();
      onComplete();
      return;
    }
    hapticError();
  };

  const { operation, left, right } = round.question;
  const question = t(MATH_SPOKEN_KEY[operation], { left, right });
  const lineKey = MATH_LINE_KEY[mathLineOf(board)];
  const line = lineKey ? t(lineKey) : "";
  const entering = reduceMotion ? undefined : FadeIn.duration(BOARD_SWAP_MS.IN);
  const exiting = reduceMotion ? undefined : FadeOut.duration(BOARD_SWAP_MS.OUT);

  return (
    <VStack gap="$stack">
      <Box
        ref={sumRef}
        testID={BOARD_PART.MATH_SUM}
        accessible
        accessibilityLabel={
          asked > 0 ? t("a11y.alarm.task.math.afterMiss", { sum: question }) : question
        }
        alignItems="center">
        <Animated.View key={asked} entering={entering} exiting={exiting}>
          <Text
            color="$fg"
            fontWeight="700"
            numeric
            numberOfLines={1}
            adjustsFontSizeToFit
            textAlign="center"
            fontSize={BOARD_TYPE.SUM.fontSize}
            lineHeight={BOARD_TYPE.SUM.lineHeight}>
            {`${LTR_ISOLATE.OPEN}${formatted(left)} ${MATH_SYMBOL[operation]} ${formatted(right)}${LTR_ISOLATE.CLOSE}`}
          </Text>
        </Animated.View>
      </Box>

      <Text
        testID={BOARD_PART.MATH_LINE}
        size="lg"
        fontWeight="600"
        color="$muted"
        textAlign="center"
        minHeight="$12">
        {line}
      </Text>

      <Animated.View key={asked} entering={entering} exiting={exiting}>
        <Grid columns={2} gap="$stack">
          {ANSWER_CARD_POSITIONS.map((position) => (
            <Grid.Item key={position}>
              <AnswerCard
                kind={ANSWER_CARD_KIND.NUMERAL}
                label={formatted(round.cards[position])}
                spoken={t("a11y.alarm.task.card", {
                  label: formatted(round.cards[position]),
                  place: t(ANSWER_CARD_PLACE_KEY[position]),
                })}
                state={cardStateOf(board, position)}
                onPress={() => choose(position)}
              />
            </Grid.Item>
          ))}
        </Grid>
      </Animated.View>
    </VStack>
  );
};

export default MathBoard;
