import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";
import { LIST_ROW_STYLE, LIST_ROW_VARIANT } from "@/components/ui/list-row";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Test ids for the row's parts. */
export const CHOICE_ROW_PART = { CHECK: "choice-row-check", TICK: "choice-row-tick" } as const;

/** A list card, tall enough for a 58pt swatch inside its padding. */
const CARD_FRAME = {
  ...LIST_ROW_STYLE[LIST_ROW_VARIANT.CARD].frame,
  minHeight: 84,
  paddingHorizontal: "$2.5",
} as const;
/** A pressed card shrinks a touch and keeps its full colour. */
const PRESSED = { opacity: 1, scale: 0.99 } as const;
const PRESSED_STILL = { opacity: 1 } as const;
const CHECK_SIZE = 22;
const CHECK_EDGE = 1.5;
const TICK_SIZE = 13;
const TICK_STROKE = 2.2;

/** The name and its line, set as a grouped row sets them. */
const TEXT = LIST_ROW_STYLE[LIST_ROW_VARIANT.GROUPED];

/** The chosen row's mark: filled in the accent, or an empty ring. */
const ChoiceCheck = ({ selected }: { selected: boolean }) => (
  <Box
    testID={CHOICE_ROW_PART.CHECK}
    width={CHECK_SIZE}
    height={CHECK_SIZE}
    borderRadius="$pill"
    borderWidth={CHECK_EDGE}
    borderColor={selected ? "$accent" : "$muted"}
    backgroundColor={selected ? "$accent" : "transparent"}
    alignItems="center"
    justifyContent="center">
    {selected ? (
      <Box testID={CHOICE_ROW_PART.TICK}>
        <Icon as={Check} size={TICK_SIZE} color="$bg" strokeWidth={TICK_STROKE} />
      </Box>
    ) : null}
  </Box>
);

type Props = {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  /** Drawn at the start of the row, such as a preview of the choice. */
  leading?: ReactNode;
};

/** One option of several: a radio with its name, a line on it and a check. */
export const ChoiceRow = ({ title, subtitle, selected, onPress, leading }: Props) => {
  const { t } = useTranslation();
  const reduced = useReducedMotion();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={subtitle ? t("a11y.join", { first: title, second: subtitle }) : title}
      flexDirection="row"
      alignItems="center"
      gap="$3"
      {...CARD_FRAME}
      {...(selected && { borderColor: "$accent", backgroundColor: "$accentSoft" })}
      pressStyle={reduced ? PRESSED_STILL : PRESSED}>
      {leading}
      <VStack flex={1}>
        <Text {...TEXT.title} color="$fg">
          {title}
        </Text>
        {subtitle ? (
          <Text {...TEXT.status} color="$muted">
            {subtitle}
          </Text>
        ) : null}
      </VStack>
      <ChoiceCheck selected={selected} />
    </Pressable>
  );
};

/** The rows of one choice, read as a named radio group. */
export const ChoiceGroup = ({ label, children }: { label: string; children: ReactNode }) => (
  <VStack accessibilityRole="radiogroup" accessibilityLabel={label} gap="$2">
    {children}
  </VStack>
);
