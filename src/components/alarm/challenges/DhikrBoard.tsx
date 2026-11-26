import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { ViewInstance } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import AnswerCard from "@/components/alarm/challenges/AnswerCard";
import DhikrWord from "@/components/alarm/challenges/DhikrWord";
import { announceMiss } from "@/components/alarm/challenges/announceMiss";
import { holdForAnnouncement } from "@/components/alarm/challenges/holdForAnnouncement";
import type { BoardProps } from "@/components/alarm/challenges/taskBoards";
import { Box } from "@/components/ui/box";
import { Grid } from "@/components/ui/grid";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { DHIKR_TASK_ROWS } from "@/constants/DhikrTask";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import {
  ANSWER_CARD_KIND,
  ANSWER_CARD_PLACE_KEY,
  ANSWER_CARD_POSITIONS,
  ANSWER_CARD_STATE,
  BOARD_PART,
  BOARD_SWAP_MS,
  BOARD_TYPE,
  DHIKR_FILL_MS,
  DHIKR_HOLD_MS,
  DHIKR_PHASE,
  DHIKR_SPOKEN_PAUSE,
  type AnswerCardPosition,
  type DhikrPhase,
} from "@/constants/WakeTaskBoards";
import { useHaptic } from "@/hooks/useHaptic";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useScreenReader } from "@/hooks/useScreenReader";
import { focusOn } from "@/utils/accessibilityFocus";
import { dhikrLineOf, drawDhikrRound, fullDhikr, spokenDhikrLine } from "@/utils/dhikrTask";
import type { Rng } from "@/utils/rng";

type Props = BoardProps & {
  /** Draws each dhikr and deals its cards; tests pass a seeded one. */
  rng?: Rng;
};

const NONE_DRAWN: readonly number[] = [];

/** The gap in the dhikr, empty or holding its word. */
const Gap = ({ word, fade }: { word: string | null; fade: boolean }) => (
  <Box
    testID={BOARD_PART.DHIKR_SLOT}
    minWidth="$24"
    minHeight="$12"
    paddingHorizontal="$inline"
    alignItems="center"
    justifyContent="center"
    borderRadius="$chip"
    borderWidth={2}
    borderStyle={word ? "solid" : "dashed"}
    borderColor="$accent">
    {word ? (
      <Animated.View entering={fade ? FadeIn.duration(DHIKR_FILL_MS) : undefined}>
        <DhikrWord type={BOARD_TYPE.DHIKR}>{word}</DhikrWord>
      </Animated.View>
    ) : null}
  </Box>
);

/** A dhikr with one word missing and four cards; another card completes it
 *  for a moment, then a different dhikr takes its place. */
const DhikrBoard = ({ onComplete, drawn = NONE_DRAWN, onDraw, rng = Math.random }: Props) => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const screenReader = useScreenReader();
  const hapticSuccess = useHaptic(HAPTIC_FEEDBACK.SUCCESS);
  const hapticLight = useHaptic(HAPTIC_FEEDBACK.LIGHT);
  // The rows this run has shown, the board's own included.
  const [run, setRun] = useState(() => {
    const round = drawDhikrRound(DHIKR_TASK_ROWS, drawn, rng);
    return { round, seen: [...drawn, round.row] };
  });
  const [phase, setPhase] = useState<DhikrPhase>(DHIKR_PHASE.ASKING);
  // Dhikr replaced so far; each mounts its line and cards fresh.
  const [replaced, setReplaced] = useState(0);
  const lineRef = useRef<ViewInstance>(null);

  const { round } = run;
  const row = DHIKR_TASK_ROWS[round.row];

  const reportDraw = useEffectEvent((index: number) => onDraw?.(index));
  useEffect(() => {
    reportDraw(round.row);
  }, [round]);

  const replace = useEffectEvent(() => {
    const next = drawDhikrRound(DHIKR_TASK_ROWS, run.seen, rng);
    setRun({ round: next, seen: [...run.seen, next.row] });
    setPhase(DHIKR_PHASE.ASKING);
    setReplaced((count) => count + 1);
  });

  const completed = t("a11y.alarm.task.dhikr.completed", {
    word: row.answer,
    dhikr: fullDhikr(row),
  });

  useEffect(() => {
    if (phase !== DHIKR_PHASE.HELD) return;
    if (screenReader) return holdForAnnouncement(completed, () => replace());
    const id = setTimeout(() => replace(), DHIKR_HOLD_MS.DEFAULT);
    return () => clearTimeout(id);
  }, [phase, screenReader, completed]);

  // Reader focus follows each new dhikr after the first.
  useEffect(() => {
    if (replaced > 0) focusOn(lineRef.current);
  }, [replaced]);

  const choose = (position: AnswerCardPosition) => {
    if (phase !== DHIKR_PHASE.ASKING) return;
    if (round.cards[position] === row.answer) {
      setPhase(DHIKR_PHASE.SOLVED);
      hapticSuccess();
      onComplete();
      return;
    }
    hapticLight();
    setPhase(DHIKR_PHASE.HELD);
    announceMiss(completed);
  };

  const asking = phase === DHIKR_PHASE.ASKING;
  const held = phase === DHIKR_PHASE.HELD;
  const spoken = spokenDhikrLine(row, t("a11y.alarm.task.dhikr.gap"), DHIKR_SPOKEN_PAUSE);
  const lineLabel = !asking
    ? fullDhikr(row)
    : replaced > 0
      ? t("a11y.alarm.task.dhikr.another", { dhikr: spoken })
      : spoken;
  const { before, touchingBefore, touchingAfter, after } = dhikrLineOf(row);
  const word = (text: string, index: number) => (
    <DhikrWord key={index} type={BOARD_TYPE.DHIKR}>
      {text}
    </DhikrWord>
  );
  const entering = reduceMotion ? undefined : FadeIn.duration(BOARD_SWAP_MS.IN);
  const exiting = reduceMotion ? undefined : FadeOut.duration(BOARD_SWAP_MS.OUT);

  return (
    <VStack gap="$stack">
      <Text size="lg" color="$muted" textAlign="center">
        {t("alarm.task.dhikr.ask")}
      </Text>

      <Animated.View key={`line-${replaced}`} entering={entering} exiting={exiting}>
        <VStack
          gap="$inline"
          paddingVertical="$stack"
          paddingHorizontal="$group"
          borderRadius="$hero"
          borderWidth={1.5}
          borderColor="$hairline"
          backgroundColor="$surface">
          {/* Its line is kept while empty, so the panel and cards never move. */}
          <Text
            testID={BOARD_PART.DHIKR_NOTE}
            size="label"
            color="$muted"
            textAlign="center"
            minHeight="$6"
            {...(!held && HIDDEN_FROM_READER)}>
            {held ? t("alarm.task.dhikr.completed") : ""}
          </Text>
          <Box
            ref={lineRef}
            testID={BOARD_PART.DHIKR_TEXT}
            accessible
            accessibilityLabel={lineLabel}
            direction="rtl"
            flexDirection="row"
            flexWrap="wrap"
            justifyContent="center"
            alignItems="center"
            columnGap="$inline">
            {before.map(word)}
            <Box flexDirection="row" alignItems="center">
              {/* Its end faces the gap, so it takes no end room. */}
              {touchingBefore ? (
                <DhikrWord type={BOARD_TYPE.DHIKR} glyph>
                  {touchingBefore}
                </DhikrWord>
              ) : null}
              <Gap word={asking ? null : row.answer} fade={!reduceMotion} />
              {touchingAfter ? word(touchingAfter, 0) : null}
            </Box>
            {after.map(word)}
          </Box>
        </VStack>
      </Animated.View>

      <Text
        testID={BOARD_PART.DHIKR_MESSAGE}
        size="lg"
        fontWeight="600"
        color="$muted"
        textAlign="center"
        minHeight="$12">
        {asking && replaced > 0 ? t("alarm.task.dhikr.another") : ""}
      </Text>

      <Animated.View key={`cards-${replaced}`} entering={entering} exiting={exiting}>
        <Grid columns={2} gap="$stack">
          {ANSWER_CARD_POSITIONS.map((position) => (
            <Grid.Item key={position}>
              <AnswerCard
                kind={ANSWER_CARD_KIND.DHIKR}
                label={round.cards[position]}
                spoken={t("a11y.alarm.task.card", {
                  label: round.cards[position],
                  place: t(ANSWER_CARD_PLACE_KEY[position]),
                })}
                state={asking ? ANSWER_CARD_STATE.REST : ANSWER_CARD_STATE.HELD}
                onPress={() => choose(position)}
              />
            </Grid.Item>
          ))}
        </Grid>
      </Animated.View>
    </VStack>
  );
};

export default DhikrBoard;
