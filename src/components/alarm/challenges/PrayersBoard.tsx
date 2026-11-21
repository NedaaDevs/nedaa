import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { ViewInstance } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import AnswerCard from "@/components/alarm/challenges/AnswerCard";
import type { BoardProps } from "@/components/alarm/challenges/taskBoards";
import { Box } from "@/components/ui/box";
import { Grid } from "@/components/ui/grid";
import { HStack } from "@/components/ui/hstack";
import { SpokenStatus } from "@/components/ui/live-region";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { PRAYER_IDS, type PrayerId } from "@/constants/Prayer";
import {
  ANSWER_CARD_KIND,
  ANSWER_CARD_STATE,
  BOARD_PART,
  BOARD_SWAP_MS,
  PRAYER_PLACE_EMPTY,
  PRAYER_PLACE_FILL_MS,
  PRAYER_PLACE_KEY,
  PRAYER_TAP,
  WRONG_CARD_HOLD_MS,
} from "@/constants/WakeTaskBoards";
import { useHaptic } from "@/hooks/useHaptic";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { focusOn } from "@/utils/accessibilityFocus";
import { formatNumberToLocale } from "@/utils/number";
import { isPlaced, reshuffleUnplaced, startBoard, tapPrayer } from "@/utils/prayerOrder";
import { prayerNameKey } from "@/utils/prayerName";
import type { Rng } from "@/utils/rng";

type Props = BoardProps & {
  /** Deals and reshuffles the cards; tests pass a seeded one. */
  rng?: Rng;
};

const FIRST_PRAYER = PRAYER_IDS[0];
const LAST_PRAYER = PRAYER_IDS[PRAYER_IDS.length - 1];

const numeral = (place: number) => formatNumberToLocale(String(place + 1));

/** Spoken sentences, each ending in its own stop, read as one label. */
const spoken = (...sentences: string[]) => sentences.join(" ");

/** Five prayer cards placed Fajr to Isha; a wrong card redeals the rest. */
const PrayersBoard = ({ onComplete, rng = Math.random }: Props) => {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const hapticLight = useHaptic(HAPTIC_FEEDBACK.LIGHT);
  const hapticError = useHaptic(HAPTIC_FEEDBACK.ERROR);
  const hapticSuccess = useHaptic(HAPTIC_FEEDBACK.SUCCESS);
  const [board, setBoard] = useState(() => startBoard(rng));
  // The card held as wrong; no card takes a press meanwhile.
  const [wrong, setWrong] = useState<number | null>(null);
  // The prayer last tapped too soon, until the next placement.
  const [missed, setMissed] = useState<PrayerId | null>(null);
  // Redeals so far; reader focus moves to the places after each.
  const [deals, setDeals] = useState(0);
  const [said, setSaid] = useState<string | null>(null);
  const solved = useRef(false);
  const placesRef = useRef<ViewInstance>(null);

  const name = (prayer: PrayerId) => t(prayerNameKey(prayer, false));
  const emptyPlace = (prayer: PrayerId) => t(PRAYER_PLACE_KEY[prayer].empty);
  const filledPlace = (prayer: PrayerId) =>
    t(PRAYER_PLACE_KEY[prayer].filled, { prayer: name(prayer) });

  const reshuffle = useEffectEvent(() => {
    if (wrong === null) return;
    setMissed(board.deal[wrong]);
    setBoard(reshuffleUnplaced(board, rng));
    setWrong(null);
    setDeals((count) => count + 1);
  });

  useEffect(() => {
    if (wrong === null) return;
    const id = setTimeout(reshuffle, WRONG_CARD_HOLD_MS);
    return () => clearTimeout(id);
  }, [wrong]);

  // Reader focus follows a redeal; the shell places it on the first.
  useEffect(() => {
    if (deals > 0) focusOn(placesRef.current);
  }, [deals]);

  const choose = (slot: number) => {
    if (solved.current || wrong !== null) return;
    const result = tapPrayer(board, slot);
    switch (result.outcome) {
      case PRAYER_TAP.IGNORED:
        return;
      case PRAYER_TAP.WRONG:
        hapticError();
        setSaid(null);
        setWrong(slot);
        return;
      case PRAYER_TAP.PLACED: {
        hapticLight();
        const prayer = board.deal[slot];
        setBoard(result.state);
        setMissed(null);
        setSaid(spoken(filledPlace(prayer), emptyPlace(PRAYER_IDS[result.state.placed])));
        return;
      }
      case PRAYER_TAP.DONE:
        solved.current = true;
        hapticSuccess();
        setBoard(result.state);
        setMissed(null);
        onComplete();
        return;
      default: {
        const unhandled: never = result;
        throw new Error(`unhandled prayer tap: ${String(unhandled)}`);
      }
    }
  };

  const next = board.placed < PRAYER_IDS.length ? PRAYER_IDS[board.placed] : null;
  const previous = board.placed > 0 ? PRAYER_IDS[board.placed - 1] : null;

  // The places speak for the placed cards: each filled one, then the next.
  const placesLabel = () =>
    spoken(
      ...(missed === null
        ? []
        : [t("a11y.alarm.task.prayers.afterMiss", { prayer: name(missed) })]),
      ...PRAYER_IDS.slice(0, board.placed).map(filledPlace),
      ...(next === null ? [] : [emptyPlace(next)])
    );

  // The same words whether or not the redeal moved a card.
  const line = () => {
    if (wrong !== null) return t("alarm.task.prayers.wrong", { prayer: name(board.deal[wrong]) });
    if (missed === null) return "";
    if (previous === null) return t("alarm.task.prayers.dealt");
    return t("alarm.task.prayers.dealtNext", { prayer: name(previous) });
  };

  const cardOf = (slot: number) => {
    const prayer = board.deal[slot];
    const shared = {
      kind: ANSWER_CARD_KIND.WORD,
      label: name(prayer),
      spoken: name(prayer),
      onPress: () => choose(slot),
    };
    if (isPlaced(board, slot)) {
      return (
        <AnswerCard
          {...shared}
          state={ANSWER_CARD_STATE.PLACED}
          mark={numeral(PRAYER_IDS.indexOf(prayer))}
        />
      );
    }
    const state =
      wrong === null
        ? ANSWER_CARD_STATE.REST
        : wrong === slot
          ? ANSWER_CARD_STATE.WRONG
          : ANSWER_CARD_STATE.HELD;
    return <AnswerCard {...shared} state={state} />;
  };

  const filling = reduceMotion ? undefined : FadeIn.duration(PRAYER_PLACE_FILL_MS);
  const entering = reduceMotion ? undefined : FadeIn.duration(BOARD_SWAP_MS.IN);
  const exiting = reduceMotion ? undefined : FadeOut.duration(BOARD_SWAP_MS.OUT);

  return (
    <VStack gap="$stack">
      <Text size="lg" color="$muted" textAlign="center">
        {t("alarm.task.prayers.ask", {
          first: name(FIRST_PRAYER),
          last: name(LAST_PRAYER),
        })}
      </Text>

      <HStack
        ref={placesRef}
        testID={BOARD_PART.PRAYER_PLACES}
        accessible
        accessibilityLabel={placesLabel()}
        gap="$1.5">
        {PRAYER_IDS.map((prayer, place) => {
          const filled = place < board.placed;
          const upNext = place === board.placed;
          return (
            <Box
              key={prayer}
              testID={BOARD_PART.PRAYER_PLACE}
              flex={1}
              minHeight="$16"
              alignItems="center"
              justifyContent="center"
              paddingVertical="$1.5"
              paddingHorizontal="$0.5"
              borderRadius="$control"
              borderWidth={upNext ? 2.5 : 1.5}
              borderStyle={filled || upNext ? "solid" : "dashed"}
              borderColor={upNext ? "$accent" : filled ? "$fg" : "$hairline"}
              backgroundColor={filled ? "$surface" : undefined}
              {...HIDDEN_FROM_READER}>
              <Text size="helper" fontWeight="600" color="$muted" numeric>
                {numeral(place)}
              </Text>
              {filled ? (
                <Animated.View key={prayer} entering={filling}>
                  <Text
                    size="md"
                    typography="body"
                    fontWeight="600"
                    color="$fg"
                    numberOfLines={1}
                    adjustsFontSizeToFit>
                    {name(prayer)}
                  </Text>
                </Animated.View>
              ) : (
                <Text size="md" typography="body" fontWeight="600" color="$muted">
                  {PRAYER_PLACE_EMPTY}
                </Text>
              )}
            </Box>
          );
        })}
      </HStack>

      <Text
        testID={BOARD_PART.PRAYER_LINE}
        size="lg"
        fontWeight="600"
        color="$muted"
        textAlign="center"
        minHeight="$12">
        {line()}
      </Text>

      <Grid columns={2} gap="$stack">
        {board.deal.map((_, slot) => {
          const placed = isPlaced(board, slot);
          // Keyed by slot: a redeal fades each open card's content in place.
          return (
            <Grid.Item key={slot} wide={slot === board.deal.length - 1}>
              <Animated.View
                key={placed ? ANSWER_CARD_STATE.PLACED : deals}
                entering={placed ? undefined : entering}
                exiting={placed ? undefined : exiting}>
                {cardOf(slot)}
              </Animated.View>
            </Grid.Item>
          );
        })}
      </Grid>

      <SpokenStatus testID={BOARD_PART.PRAYER_STATUS} message={said} />
    </VStack>
  );
};

export default PrayersBoard;
