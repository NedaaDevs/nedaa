import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";

export const PILL_TONE = {
  /** A plain fact, such as the app version. */
  ACCENT: "accent",
  /** A state out of the ordinary, such as debug mode. */
  WARN: "warn",
} as const;
export type PillTone = (typeof PILL_TONE)[keyof typeof PILL_TONE];

const TONE_STYLE = {
  [PILL_TONE.ACCENT]: { edge: "$accentEdge", ink: "$accent" },
  [PILL_TONE.WARN]: { edge: "$warn", ink: "$fg" },
} as const satisfies Record<PillTone, { edge: string; ink: string }>;

type Props = { children: string; tone?: PillTone; testID?: string };

/** A short label in a rounded frame. */
export const Pill = ({ children, tone = PILL_TONE.ACCENT, testID }: Props) => (
  <Box
    testID={testID}
    alignSelf="center"
    paddingHorizontal="$2"
    paddingVertical="$1"
    borderWidth={1}
    borderColor={TONE_STYLE[tone].edge}
    borderRadius="$pill"
    backgroundColor="$surface2">
    <Text size="xs" bold color={TONE_STYLE[tone].ink}>
      {children}
    </Text>
  </Box>
);
