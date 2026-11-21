import { X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { usePressScale } from "@/components/ui/pressable/pressScale";
import { Text } from "@/components/ui/text";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import {
  ANSWER_CARD_PLACE_KEY,
  ANSWER_CARD_STATE,
  BOARD_PART,
  BOARD_TYPE,
  type AnswerCardPosition,
  type AnswerCardState,
} from "@/constants/WakeTaskBoards";

type Props = {
  /** What the card shows, as the board formats it. */
  label: string;
  position: AnswerCardPosition;
  state: AnswerCardState;
  onPress: () => void;
};

/** One answer on a board's grid; a held or wrong card takes no press. */
const AnswerCard = ({ label, position, state, onPress }: Props) => {
  const { t } = useTranslation();
  const press = usePressScale();
  const wrong = state === ANSWER_CARD_STATE.WRONG;
  const still = state !== ANSWER_CARD_STATE.REST;
  const card = t("a11y.alarm.task.card", {
    label,
    place: t(ANSWER_CARD_PLACE_KEY[position]),
  });

  return (
    <Pressable
      testID={BOARD_PART.ANSWER_CARD}
      accessibilityLabel={wrong ? t("a11y.alarm.task.cardWrong", { card }) : card}
      // Marked by its X and dashed border; the `disabled` prop would fade it.
      accessibilityState={{ disabled: still }}
      onPress={still ? undefined : onPress}
      minHeight="$24"
      alignItems="center"
      justifyContent="center"
      paddingHorizontal="$stack"
      borderRadius="$card"
      borderWidth={wrong ? 2 : 1.5}
      borderStyle={wrong ? "dashed" : "solid"}
      borderColor={wrong ? "$danger" : "$hairline"}
      backgroundColor="$surface"
      transition={press.transition}
      animateOnly={press.animateOnly}
      pressStyle={
        still
          ? { opacity: 1 }
          : { ...press.pressStyle, opacity: 1, backgroundColor: "$pressed", borderColor: "$fg" }
      }>
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
      {wrong && (
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
          borderColor="$danger"
          {...HIDDEN_FROM_READER}>
          <Icon as={X} size="sm" color="$danger" />
        </Box>
      )}
    </Pressable>
  );
};

export default AnswerCard;
