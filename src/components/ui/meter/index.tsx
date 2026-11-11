import { Box } from "@/components/ui/box";

/** Test ids for the meter's parts. */
export const METER_PART = { FILL: "meter-fill" } as const;

type Props = { value: number; max: number; label: string };

/** A thin progress bar; the reader gets its numbers, not only its length. */
export const Meter = ({ value, max, label }: Props) => (
  <Box
    accessible
    accessibilityRole="progressbar"
    accessibilityLabel={label}
    accessibilityValue={{ min: 0, max, now: value }}
    height="$1"
    borderRadius="$pill"
    overflow="hidden"
    backgroundColor="$border">
    <Box
      testID={METER_PART.FILL}
      height="100%"
      width={`${(Math.min(value, max) / max) * 100}%`}
      borderRadius="$pill"
      backgroundColor="$muted"
    />
  </Box>
);
