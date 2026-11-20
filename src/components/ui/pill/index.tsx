import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import type { ColorToken } from "@/constants/Palette";

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

/** Each tone's palette keys; a fill, never a line, carries the tone. */
export const PILL_PAINT = {
  [PILL_TONE.ACCENT]: { fill: "accentTint", ink: "accentText", lead: "accentText" },
  [PILL_TONE.WARN]: { fill: "warnTint", ink: "fg", lead: "fg" },
  [PILL_TONE.NEUTRAL]: { fill: "surfaceQuiet", ink: "fg", lead: "mutedSky" },
} as const satisfies Record<PillTone, Record<"fill" | "ink" | "lead", ColorToken>>;

/** No size step is 26; the pill stands this high at least. */
const PILL_MIN_HEIGHT = 26;

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
  const { fill, ink, lead } = PILL_PAINT[tone];

  return (
    <HStack
      testID={testID}
      alignSelf={alignSelf}
      alignItems="center"
      gap="$1.5"
      minHeight={PILL_MIN_HEIGHT}
      paddingHorizontal="$2.5"
      paddingVertical="$0.5"
      borderRadius="$pill"
      backgroundColor={`$${fill}`}>
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
        <Text size="sm" fontWeight="500" color={`$${lead}`}>
          {label}
        </Text>
      ) : null}
      <Text size="sm" fontWeight="600" color={`$${ink}`}>
        {children}
      </Text>
    </HStack>
  );
};
