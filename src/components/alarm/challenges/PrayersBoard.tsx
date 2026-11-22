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
  PRAYER_LINE,
  PRAYER_LINE_KEY,
  PRAYER_PLACE_EMPTY,
  PRAYER_PLACE_FILL_MS,
  PRAYER_PLACE_KEY,
  PRAYER_PLACE_PART,
  PRAYER_TAP,
  WRONG_CARD_HOLD_MS,
} from "@/constants/WakeTaskBoards";
import { useHaptic } from "@/hooks/useHaptic";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { focusOn } from "@/utils/accessibilityFocus";
import { formatNumberToLocale } from "@/utils/number";
import { prayerNameKey } from "@/utils/prayerName";
import {
  endWrongHold,
  placedSaidOf,
  placesSpokenOf,
  prayerCardStateOf,
  prayerLineOf,
  startPrayersBoard,
  tapPrayerCard,
  type PlaceSaid,
  type PrayersBoardState,
} from "@/utils/prayersBoard";
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
  const [board, setBoard] = useState(() => startPrayersBoard(rng));
  // Taps read this, so two in one frame see the first one's board.
  const live = useRef(board);
  const [said, setSaid] = useState<string | null>(null);
  const placesRef = useRef<ViewInstance>(null);
  const { order, wrong, deals } = board;

  const commit = (next: PrayersBoardState) => {
    live.current = next;
    setBoard(next);
  };

  const name = (prayer: PrayerId) => t(prayerNameKey(prayer, false));
  const emptyPlace = (prayer: PrayerId) => t(PRAYER_PLACE_KEY[prayer].empty);
  const filledPlace = (prayer: PrayerId) =>
    t(PRAYER_PLACE_KEY[prayer].filled, { prayer: name(prayer) });

  const sayPart = ({ part, prayer }: PlaceSaid) => {
    switch (part) {
      case PRAYER_PLACE_PART.AFTER_MISS:
        return t("a11y.alarm.task.prayers.afterMiss", { prayer: name(prayer) });
      case PRAYER_PLACE_PART.FILLED:
        return filledPlace(prayer);
      case PRAYER_PLACE_PART.EMPTY:
        return emptyPlace(prayer);
      default: {
        const unhandled: never = part;
        throw new Error(`unhandled place part: ${String(unhandled)}`);
      }
    }
  };

  const reshuffle = useEffectEvent(() => commit(endWrongHold(live.current, rng)));

  useEffect(() => {
    if (wrong === null) return;
    const id = setTimeout(reshuffle, WRONG_CARD_HOLD_MS);
    return () => clearTimeout(id);
  }, [wrong]);

  // Reader focus follows each redeal; the first deal moves no focus.
  useEffect(() => {
    if (deals > 0) focusOn(placesRef.current);
  }, [deals]);

  const choose = (slot: number) => {
    const result = tapPrayerCard(live.current, slot);
    switch (result.outcome) {
      case PRAYER_TAP.IGNORED:
        return;
      case PRAYER_TAP.WRONG:
        hapticError();
        setSaid(null);
        commit(result.state);
        return;
      case PRAYER_TAP.PLACED:
        hapticLight();
        commit(result.state);
        setSaid(spoken(...placedSaidOf(result.state).map(sayPart)));
        return;
      case PRAYER_TAP.DONE:
        hapticSuccess();
        commit(result.state);
        onComplete();
        return;
      default: {
        const unhandled: never = result;
        throw new Error(`unhandled prayer tap: ${String(unhandled)}`);
      }
    }
  };

  // The places speak for the placed cards: each filled one, then the next.
  const placesLabel = () => spoken(...placesSpokenOf(board).map(sayPart));

  const line = () => {
    const shown = prayerLineOf(board);
    switch (shown.line) {
      case PRAYER_LINE.NONE:
        return "";
      case PRAYER_LINE.DEALT:
        return t(PRAYER_LINE_KEY[shown.line]);
      case PRAYER_LINE.WRONG:
      case PRAYER_LINE.DEALT_NEXT:
        return t(PRAYER_LINE_KEY[shown.line], { prayer: name(shown.prayer) });
      default: {
        const unhandled: never = shown;
        throw new Error(`unhandled prayer line: ${String(unhandled)}`);
      }
    }
  };

  const cardOf = (slot: number) => {
    const prayer = order.deal[slot];
    const shared = {
      kind: ANSWER_CARD_KIND.WORD,
      label: name(prayer),
      spoken: name(prayer),
      onPress: () => choose(slot),
    };
    const state = prayerCardStateOf(board, slot);
    if (state === ANSWER_CARD_STATE.PLACED) {
      return <AnswerCard {...shared} state={state} mark={numeral(PRAYER_IDS.indexOf(prayer))} />;
    }
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
          const filled = place < order.placed;
          const upNext = place === order.placed;
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
        {order.deal.map((_, slot) => {
          const placed = prayerCardStateOf(board, slot) === ANSWER_CARD_STATE.PLACED;
          // Keyed by slot: a redeal fades each open card's content in place.
          return (
            <Grid.Item key={slot} wide={slot === order.deal.length - 1}>
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
