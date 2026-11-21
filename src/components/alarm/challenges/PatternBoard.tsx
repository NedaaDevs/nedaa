import { useEffect, useEffectEvent, useRef, useState } from "react";
import { AccessibilityInfo, type AccessibilityActionEvent } from "react-native";
import { useTranslation } from "react-i18next";

import PatternPad from "@/components/alarm/challenges/PatternPad";
import type { BoardProps } from "@/components/alarm/challenges/taskBoards";
import { Box } from "@/components/ui/box";
import { Grid } from "@/components/ui/grid";
import { HStack } from "@/components/ui/hstack";
import { SpokenStatus } from "@/components/ui/live-region";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import {
  PATTERN_HEAR_AGAIN,
  PATTERN_PAD_NAME_KEY,
  PATTERN_PAD_PLACE_KEY,
  PATTERN_PAD_STATE,
  PATTERN_PADS,
  PATTERN_PART,
  PATTERN_PHASE,
  PATTERN_TAP,
  PATTERN_TIMING,
  type PatternPad as Pad,
  type PatternPadState,
  type PatternPhase,
} from "@/constants/WakeTaskBoards";
import { useHaptic } from "@/hooks/useHaptic";
import { useLayoutFocus } from "@/hooks/useLayoutFocus";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useScreenReader } from "@/hooks/useScreenReader";
import { formatNumberToLocale } from "@/utils/number";
import {
  drawPattern,
  playbackFrame,
  playbackStarts,
  playbackTiming,
  tapPad,
  type PatternState,
} from "@/utils/patternOrder";
import type { Rng } from "@/utils/rng";

type Props = BoardProps & {
  /** Draws each order; tests pass a seeded one. */
  rng?: Rng;
};

const numeral = (value: number) => formatNumberToLocale(String(value));

/** Four pads light in an order to tap back; a wrong pad plays a new one. */
const PatternBoard = ({ difficulty, onComplete, opening, rng = Math.random }: Props) => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const screenReader = useScreenReader();
  const hapticLight = useHaptic(HAPTIC_FEEDBACK.LIGHT);
  const hapticError = useHaptic(HAPTIC_FEEDBACK.ERROR);
  const hapticSuccess = useHaptic(HAPTIC_FEEDBACK.SUCCESS);
  const [board, setBoard] = useState<PatternState>(() => ({
    pattern: drawPattern(difficulty, rng),
    done: 0,
  }));
  // Where the playing order stands; its last step opens the turn.
  const [step, setStep] = useState(0);
  // Orders played so far; reader focus goes to the status with each one.
  const [plays, setPlays] = useState(0);
  // The pad held as wrong; no pad takes a tap meanwhile.
  const [wrong, setWrong] = useState<Pad | null>(null);
  // True from a miss until the next right tap.
  const [missed, setMissed] = useState(false);
  const [solved, setSolved] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const solving = useRef(false);
  const { ref: statusRef, onLayout: onStatusLayout, focus: focusStatus } = useLayoutFocus();

  const total = board.pattern.length;
  const frame = playbackFrame(step, total);
  const phase: PatternPhase = solved
    ? PATTERN_PHASE.SOLVED
    : wrong !== null
      ? PATTERN_PHASE.WRONG
      : frame.playing
        ? PATTERN_PHASE.WATCHING
        : PATTERN_PHASE.REPEATING;

  const schedule = useEffectEvent(() =>
    playbackStarts(total, playbackTiming({ reduceMotion, screenReader }))
  );
  const focusIfReading = useEffectEvent(() => {
    if (screenReader) focusStatus();
  });

  useEffect(() => {
    focusIfReading();
    const ids = schedule()
      .slice(1)
      .map((at, index) => setTimeout(() => setStep(index + 1), at));
    return () => ids.forEach(clearTimeout);
  }, [plays]);

  const replace = useEffectEvent(() => {
    setBoard({ pattern: drawPattern(difficulty, rng, board.pattern), done: 0 });
    setWrong(null);
    setMissed(true);
    setStep(0);
    setPlays((count) => count + 1);
  });

  useEffect(() => {
    if (wrong === null) return;
    const id = setTimeout(replace, PATTERN_TIMING.WRONG_HOLD);
    return () => clearTimeout(id);
  }, [wrong]);

  const choose = (pad: Pad) => {
    if (solving.current || phase !== PATTERN_PHASE.REPEATING) return;
    const result = tapPad(board, pad);
    switch (result.outcome) {
      case PATTERN_TAP.WRONG:
        hapticError();
        setSaid(null);
        setWrong(pad);
        return;
      case PATTERN_TAP.NEXT:
        hapticLight();
        setBoard(result.state);
        setMissed(false);
        setSaid(
          t("alarm.task.tapCount", {
            done: numeral(result.state.done),
            total: numeral(total),
          })
        );
        return;
      case PATTERN_TAP.DONE:
        solving.current = true;
        hapticSuccess();
        setBoard(result.state);
        setSolved(true);
        onComplete();
        return;
      default: {
        const unhandled: never = result;
        throw new Error(`unhandled pattern tap: ${String(unhandled)}`);
      }
    }
  };

  const name = (pad: Pad) => t(PATTERN_PAD_NAME_KEY[pad]);
  const order = board.pattern.map(name).join(t("common.listSeparator"));
  const replayable = phase === PATTERN_PHASE.WATCHING || phase === PATTERN_PHASE.REPEATING;

  const hearAgain = ({ nativeEvent }: AccessibilityActionEvent) => {
    if (!replayable || nativeEvent.actionName !== PATTERN_HEAR_AGAIN) return;
    AccessibilityInfo.announceForAccessibility(t("a11y.alarm.task.pattern.again", { order }));
  };

  const watch = t("a11y.alarm.task.pattern.watch", { order });
  // The first order says the shell's opening line too: one message, not two.
  const statusLabel =
    phase === PATTERN_PHASE.WRONG
      ? t("alarm.task.pattern.wrong")
      : missed
        ? t("a11y.alarm.task.pattern.afterMiss", { order })
        : opening && plays === 0
          ? t("a11y.sentences", { first: opening, second: watch })
          : watch;

  const shownAt = numeral(Math.max(1, frame.shown));
  const line = () => {
    switch (phase) {
      case PATTERN_PHASE.WATCHING:
        return t(missed ? "alarm.task.pattern.showingNew" : "alarm.task.pattern.showing", {
          at: shownAt,
          total: numeral(total),
        });
      case PATTERN_PHASE.REPEATING:
        return t("alarm.task.pattern.turn", { done: numeral(board.done), total: numeral(total) });
      case PATTERN_PHASE.WRONG:
        return t("alarm.task.pattern.wrong");
      case PATTERN_PHASE.SOLVED:
        return t("alarm.task.pattern.done");
      default: {
        const unhandled: never = phase;
        throw new Error(`unhandled pattern phase: ${String(unhandled)}`);
      }
    }
  };

  const filled = phase === PATTERN_PHASE.WATCHING ? frame.shown : board.done;

  const stateOf = (pad: Pad): PatternPadState => {
    switch (phase) {
      case PATTERN_PHASE.WATCHING:
        return frame.lit !== null && board.pattern[frame.lit] === pad
          ? PATTERN_PAD_STATE.LIT
          : PATTERN_PAD_STATE.HELD;
      case PATTERN_PHASE.REPEATING:
        return PATTERN_PAD_STATE.REST;
      case PATTERN_PHASE.WRONG:
        return pad === wrong ? PATTERN_PAD_STATE.WRONG : PATTERN_PAD_STATE.HELD;
      case PATTERN_PHASE.SOLVED:
        return PATTERN_PAD_STATE.HELD;
      default: {
        const unhandled: never = phase;
        throw new Error(`unhandled pattern phase: ${String(unhandled)}`);
      }
    }
  };

  return (
    <VStack gap="$stack">
      <Text size="lg" color="$muted" textAlign="center">
        {t(
          phase === PATTERN_PHASE.WATCHING
            ? "alarm.task.pattern.watchAsk"
            : "alarm.task.pattern.turnAsk"
        )}
      </Text>

      <HStack
        ref={statusRef}
        onLayout={onStatusLayout}
        testID={PATTERN_PART.STATUS}
        accessible
        accessibilityLabel={statusLabel}
        accessibilityActions={
          replayable
            ? [{ name: PATTERN_HEAR_AGAIN, label: t("a11y.alarm.task.pattern.hearAgain") }]
            : []
        }
        onAccessibilityAction={hearAgain}
        minHeight="$14"
        alignItems="center"
        justifyContent="space-between"
        gap="$stack">
        <Text
          testID={PATTERN_PART.LINE}
          flex={1}
          size="lg"
          fontWeight="600"
          color={phase === PATTERN_PHASE.WRONG ? "$fg" : "$muted"}>
          {line()}
        </Text>
        {phase !== PATTERN_PHASE.WRONG && (
          <HStack gap="$2" {...HIDDEN_FROM_READER}>
            {board.pattern.map((_, index) => (
              <Box
                key={index}
                testID={PATTERN_PART.DOT}
                width="$3"
                height="$3"
                borderRadius="$pill"
                borderWidth={1.5}
                borderColor="$fg"
                backgroundColor={index < filled ? "$fg" : undefined}
              />
            ))}
          </HStack>
        )}
      </HStack>

      <Box testID={PATTERN_PART.PADS} direction="ltr">
        <Grid columns={2} gap="$stack">
          {PATTERN_PADS.map((pad) => (
            <Grid.Item key={pad}>
              <PatternPad
                pad={pad}
                spoken={t("a11y.alarm.task.card", {
                  label: name(pad),
                  place: t(PATTERN_PAD_PLACE_KEY[pad]),
                })}
                state={stateOf(pad)}
                fades={!reduceMotion}
                onPress={() => choose(pad)}
              />
            </Grid.Item>
          ))}
        </Grid>
      </Box>

      <SpokenStatus testID={PATTERN_PART.SPOKEN} message={said} />
    </VStack>
  );
};

export default PatternBoard;
