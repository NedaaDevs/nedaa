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
  ANSWER_CARD_STATE,
  BOARD_PART,
  BOARD_TYPE,
  BOARD_SWAP_MS,
  MATH_SPOKEN_KEY,
  MATH_SYMBOL,
  WRONG_CARD_HOLD_MS,
  type AnswerCardPosition,
} from "@/constants/WakeTaskBoards";
import { useHaptic } from "@/hooks/useHaptic";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { focusOn } from "@/utils/accessibilityFocus";
import { LTR_ISOLATE } from "@/utils/digits";
import { mathRound } from "@/utils/mathCards";
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
  const [round, setRound] = useState(() => mathRound(difficulty, rng));
  // Questions replaced so far; each mounts its sum and cards fresh.
  const [asked, setAsked] = useState(0);
  // The card held as wrong; no card takes a press meanwhile.
  const [wrong, setWrong] = useState<AnswerCardPosition | null>(null);
  const solved = useRef(false);
  const sumRef = useRef<ViewInstance>(null);

  const replace = useEffectEvent(() => {
    setRound(mathRound(difficulty, rng, round.question));
    setWrong(null);
    setAsked((count) => count + 1);
  });

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
    if (solved.current || wrong !== null) return;
    if (round.cards[position] === round.answer) {
      solved.current = true;
      hapticSuccess();
      onComplete();
      return;
    }
    hapticError();
    setWrong(position);
  };

  const stateOf = (position: AnswerCardPosition) => {
    if (wrong === null) return ANSWER_CARD_STATE.REST;
    return wrong === position ? ANSWER_CARD_STATE.WRONG : ANSWER_CARD_STATE.HELD;
  };

  const { operation, left, right } = round.question;
  const question = t(MATH_SPOKEN_KEY[operation], { left, right });
  const line =
    wrong !== null ? t("alarm.task.math.wrong") : asked > 0 ? t("alarm.task.math.new") : "";
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
                state={stateOf(position)}
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
