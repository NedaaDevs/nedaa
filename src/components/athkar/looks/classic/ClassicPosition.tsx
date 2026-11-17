import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { MARK_SIZE, MARK_STATE } from "@/constants/AthkarSession";
import type { PositionMark } from "@/utils/athkarSession";

/** Test ids for the kinds of mark. */
export const POSITION_PART = {
  [MARK_SIZE.FULL]: "position-mark-full",
  [MARK_SIZE.FINE]: "position-mark-fine",
  [MARK_STATE.CURRENT]: "position-mark-current",
} as const;

const CURRENT = { WIDTH: 28, HEIGHT: 8, MIN_FILL: 6 } as const;
/** A mark grows from BASIS to MAX_WIDTH as the row allows. */
const MARK = {
  [MARK_SIZE.FULL]: { BASIS: 14, MAX_WIDTH: 28, HEIGHT: 4 },
  [MARK_SIZE.FINE]: { BASIS: 3, MAX_WIDTH: 6, HEIGHT: 3 },
} as const;
/** A full mark's width beside fine marks, which take the row's spare width. */
const WINDOW_MARK_WIDTH = 12;
const MARK_MIN_WIDTH = 2;
const MARK_GAP = 2;
/** Fine marks sit closer than full ones. */
const FINE_PULL = -1;
const DONE_OPACITY = 0.55;

type MarkProps = {
  mark: PositionMark;
  fraction: number;
  /** Whether the row also holds fine marks. */
  windowed: boolean;
};

const Mark = ({ mark, fraction, windowed }: MarkProps) => {
  if (mark.state === MARK_STATE.CURRENT) {
    return (
      <Box
        testID={POSITION_PART[MARK_STATE.CURRENT]}
        width={CURRENT.WIDTH}
        height={CURRENT.HEIGHT}
        borderRadius="$pill"
        overflow="hidden"
        backgroundColor="$track">
        <Box
          height="100%"
          width={Math.max(CURRENT.MIN_FILL, CURRENT.WIDTH * Math.min(Math.max(fraction, 0), 1))}
          borderRadius="$pill"
          backgroundColor="$accent"
        />
      </Box>
    );
  }

  const done = mark.state === MARK_STATE.DONE;
  const size = MARK[mark.size];
  const fine = mark.size === MARK_SIZE.FINE;
  const fixed = windowed && !fine;
  return (
    <Box
      testID={POSITION_PART[mark.size]}
      flexGrow={fixed ? 0 : 1}
      flexShrink={fixed ? 0 : 1}
      flexBasis={fixed ? undefined : size.BASIS}
      width={fixed ? WINDOW_MARK_WIDTH : undefined}
      minWidth={MARK_MIN_WIDTH}
      maxWidth={size.MAX_WIDTH}
      marginStart={fine ? FINE_PULL : 0}
      height={size.HEIGHT}
      borderRadius="$pill"
      backgroundColor={done ? "$fg" : "$track"}
      opacity={done ? DONE_OPACITY : 1}
    />
  );
};

type Props = {
  marks: readonly PositionMark[];
  /** The place and the total as written figures, such as "9 / 18". */
  figures: string;
  /** How far the current dhikr's count is, 0 to 1. */
  fraction: number;
  accessibilityLabel: string;
  accessibilityHint: string;
  onPress: () => void;
};

/** Where the person is in the session: one mark per dhikr and the figures. Opens the list. */
export const ClassicPosition = ({
  marks,
  figures,
  fraction,
  accessibilityLabel,
  accessibilityHint,
  onPress,
}: Props) => {
  const windowed = marks.some((mark) => mark.size === MARK_SIZE.FINE);
  return (
    <Pressable
      flex={1}
      flexDirection="row"
      alignItems="center"
      gap="$3"
      borderRadius="$control"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}>
      <HStack flex={1} alignItems="center" gap={MARK_GAP}>
        {marks.map((mark) => (
          <Mark key={mark.id} mark={mark} fraction={fraction} windowed={windowed} />
        ))}
      </HStack>
      <Text size="md" fontWeight="500" color="$muted" numeric>
        {figures}
      </Text>
    </Pressable>
  );
};
