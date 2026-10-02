import { createContext, use, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react-native";
import { FontLanguage } from "tamagui";

import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_STYLE, LIST_ROW_VARIANT } from "@/components/ui/list-row";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { isArabicScript } from "@/constants/Fonts";
import type { AppLocale } from "@/enums/app";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Test ids for the row's parts. */
export const CHOICE_ROW_PART = { CHECK: "choice-row-check", TICK: "choice-row-tick" } as const;

/** Each row a card of its own, or the rows in one card with a rule between. */
export type ChoiceRowVariant = typeof LIST_ROW_VARIANT.CARD | typeof LIST_ROW_VARIANT.GROUPED;

/** A list card, tall enough for a 58pt swatch inside its padding. */
const CARD_FRAME = {
  ...LIST_ROW_STYLE[LIST_ROW_VARIANT.CARD].frame,
  minHeight: 84,
  paddingHorizontal: "$2.5",
} as const;
/** A pressed card shrinks a touch and keeps its full colour. */
const PRESSED = { opacity: 1, scale: 0.99 } as const;
const PRESSED_STILL = { opacity: 1 } as const;
/** A pressed grouped row takes the wash, as a switch row does. */
const PRESSED_WASH = { opacity: 1, backgroundColor: "$pressed" } as const;
const CHECK_SIZE = 22;
const CHECK_EDGE = 1.5;
const TICK_SIZE = 13;
const TICK_STROKE = 2.2;

/** A grouped row's frame and type; every variant sets its name and line so. */
const GROUPED_STYLE = LIST_ROW_STYLE[LIST_ROW_VARIANT.GROUPED];

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

/** The group's variant, which each of its rows draws. */
const VariantContext = createContext<ChoiceRowVariant>(LIST_ROW_VARIANT.CARD);

/** Sets its text in the face of the given locale's script, if one is given. */
const SubtitleFace = ({ locale, children }: { locale?: AppLocale; children: ReactNode }) => {
  if (!locale) return children;
  const face = isArabicScript(locale) ? "ar" : "default";
  return (
    <FontLanguage body={face} heading={face}>
      {children}
    </FontLanguage>
  );
};

type Props = {
  title: string;
  subtitle?: string;
  /** The locale the subtitle is written in; it sets the subtitle's face. */
  subtitleLocale?: AppLocale;
  selected: boolean;
  onPress: () => void;
  /** Drawn at the start of the row, such as a preview of the choice. */
  leading?: ReactNode;
};

/** One option of several: a radio with its name, a line on it and a check. */
export const ChoiceRow = ({
  title,
  subtitle,
  subtitleLocale,
  selected,
  onPress,
  leading,
}: Props) => {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const grouped = use(VariantContext) === LIST_ROW_VARIANT.GROUPED;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={subtitle ? t("a11y.join", { first: title, second: subtitle }) : title}
      flexDirection="row"
      alignItems="center"
      gap="$3"
      {...(grouped ? GROUPED_STYLE.frame : CARD_FRAME)}
      {...(selected && { backgroundColor: "$accentSoft" })}
      {...(selected && !grouped && { borderColor: "$accent" })}
      pressStyle={grouped ? PRESSED_WASH : reduced ? PRESSED_STILL : PRESSED}>
      {leading}
      <VStack flex={1}>
        <Text {...GROUPED_STYLE.title} color="$fg">
          {title}
        </Text>
        {subtitle ? (
          <SubtitleFace locale={subtitleLocale}>
            <Text {...GROUPED_STYLE.status} color="$muted">
              {subtitle}
            </Text>
          </SubtitleFace>
        ) : null}
      </VStack>
      <ChoiceCheck selected={selected} />
    </Pressable>
  );
};

type GroupProps = { label: string; variant?: ChoiceRowVariant; children: ReactNode };

/** The rows of one choice, read as a named radio group. */
export const ChoiceGroup = ({ label, variant = LIST_ROW_VARIANT.CARD, children }: GroupProps) => (
  <VariantContext value={variant}>
    <VStack accessibilityRole="radiogroup" accessibilityLabel={label} gap="$2">
      {variant === LIST_ROW_VARIANT.GROUPED ? <ListGroup>{children}</ListGroup> : children}
    </VStack>
  </VariantContext>
);
