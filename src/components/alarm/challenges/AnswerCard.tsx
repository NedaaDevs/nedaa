import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { usePressScale } from "@/components/ui/pressable/pressScale";
import { Text } from "@/components/ui/text";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import {
  ANSWER_CARD_KIND,
  ANSWER_CARD_MIN_HEIGHT,
  ANSWER_CARD_STATE,
  BOARD_PART,
  BOARD_TYPE,
  type AnswerCardKind,
} from "@/constants/WakeTaskBoards";

type Shared = {
  /** What the card shows, as the board formats it. */
  label: string;
  /** What a screen reader calls the card. */
  spoken: string;
  kind: AnswerCardKind;
  onPress: () => void;
};

type Unmarked = {
  state:
    typeof ANSWER_CARD_STATE.REST | typeof ANSWER_CARD_STATE.HELD | typeof ANSWER_CARD_STATE.WRONG;
};

/** A placed card draws its place number and is hidden from the reader. */
type Placed = { state: typeof ANSWER_CARD_STATE.PLACED; mark: string };

type Props = Shared & (Unmarked | Placed);

/** The corner badge a wrong or placed card carries; drawn only. */
const Mark = ({ tone, children }: { tone: "$danger" | "$accent"; children: ReactNode }) => (
  <Box
    testID={BOARD_PART.ANSWER_MARK}
    position="absolute"
    top="$2"
    end="$2"
    width="$7"
    height="$7"
    alignItems="center"
    justifyContent="center"
    borderRadius="$pill"
    borderWidth={2}
    borderColor={tone}
    {...HIDDEN_FROM_READER}>
    {children}
  </Box>
);

/** One answer on a board's grid; only a card at rest takes a press. */
const AnswerCard = (props: Props) => {
  const { label, spoken, kind, state, onPress } = props;
  const { t } = useTranslation();
  const press = usePressScale();
  const wrong = state === ANSWER_CARD_STATE.WRONG;
  const placed = state === ANSWER_CARD_STATE.PLACED;
  const still = state !== ANSWER_CARD_STATE.REST;

  return (
    <Pressable
      testID={BOARD_PART.ANSWER_CARD}
      accessibilityLabel={wrong ? t("a11y.alarm.task.cardWrong", { card: spoken }) : spoken}
      // Marked by its border and badge; the `disabled` prop would fade it.
      accessibilityState={{ disabled: still }}
      // A placed card is read through the board's places instead.
      {...(placed ? HIDDEN_FROM_READER : undefined)}
      onPress={still ? undefined : onPress}
      minHeight={ANSWER_CARD_MIN_HEIGHT[kind]}
      alignItems="center"
      justifyContent="center"
      paddingHorizontal="$stack"
      borderRadius="$card"
      borderWidth={wrong ? 2 : placed ? 2.5 : 1.5}
      borderStyle={wrong ? "dashed" : "solid"}
      borderColor={wrong ? "$danger" : placed ? "$accent" : "$hairline"}
      backgroundColor="$surface"
      transition={press.transition}
      animateOnly={press.animateOnly}
      pressStyle={
        still
          ? { opacity: 1 }
          : { ...press.pressStyle, opacity: 1, backgroundColor: "$pressed", borderColor: "$fg" }
      }>
      {kind === ANSWER_CARD_KIND.NUMERAL ? (
        <Text
          color="$fg"
          fontWeight="600"
          numeric
          numberOfLines={1}
          adjustsFontSizeToFit
          fontSize={BOARD_TYPE.CARD_NUMERAL.fontSize}
          lineHeight={BOARD_TYPE.CARD_NUMERAL.lineHeight}>
          {label}
        </Text>
      ) : (
        <Text
          color="$fg"
          size="headline"
          typography="helper"
          fontWeight="600"
          numberOfLines={1}
          adjustsFontSizeToFit>
          {label}
        </Text>
      )}
      {wrong && (
        <Mark tone="$danger">
          <Icon as={X} size="sm" color="$danger" />
        </Mark>
      )}
      {props.state === ANSWER_CARD_STATE.PLACED && (
        <Mark tone="$accent">
          <Text size="label" bold numeric color="$accentText">
            {props.mark}
          </Text>
        </Mark>
      )}
    </Pressable>
  );
};

export default AnswerCard;
