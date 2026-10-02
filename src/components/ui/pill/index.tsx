import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";

export const PILL_TONE = {
  /** A plain fact, such as the app version. */
  ACCENT: "accent",
  /** A state out of the ordinary, such as debug mode. */
  WARN: "warn",
  /** A fact set over the sky, such as the next prayer. */
  NEUTRAL: "neutral",
} as const;
export type PillTone = (typeof PILL_TONE)[keyof typeof PILL_TONE];

/** Test ids for the pill's parts. */
export const PILL_PART = { DOT: "pill-dot" } as const;

/** `lead` inks the label; `$mutedSky` is 7.7:1 on the chip over day sky. */
const TONE_STYLE = {
  [PILL_TONE.ACCENT]: { edge: "$accentEdge", ink: "$accent", lead: "$accent" },
  [PILL_TONE.WARN]: { edge: "$warn", ink: "$fg", lead: "$fg" },
  [PILL_TONE.NEUTRAL]: { edge: "$border", ink: "$fg", lead: "$mutedSky" },
} as const satisfies Record<PillTone, { edge: string; ink: string; lead: string }>;

type Props = {
  children: string;
  /** Read before the text and set lighter, naming what the text is. */
  label?: string;
  /** Marks the start with a small accent dot. */
  dot?: boolean;
  tone?: PillTone;
  /** Where it sits across its parent; centred unless told otherwise. */
  alignSelf?: "center" | "flex-start";
  testID?: string;
};

/** A short label in a rounded frame. */
export const Pill = ({
  children,
  label,
  dot = false,
  tone = PILL_TONE.ACCENT,
  alignSelf = "center",
  testID,
}: Props) => {
  const { edge, ink, lead } = TONE_STYLE[tone];

  return (
    <HStack
      testID={testID}
      alignSelf={alignSelf}
      alignItems="center"
      gap="$1.5"
      paddingHorizontal="$2"
      paddingVertical="$1"
      borderWidth={1}
      borderColor={edge}
      borderRadius="$pill"
      backgroundColor="$surface2">
      {dot ? (
        <Box
          testID={PILL_PART.DOT}
          width="$1.5"
          height="$1.5"
          borderRadius="$pill"
          backgroundColor="$accent"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      {label ? (
        <Text size="xs" fontWeight="500" color={lead}>
          {label}
        </Text>
      ) : null}
      <Text size="xs" bold color={ink}>
        {children}
      </Text>
    </HStack>
  );
};
