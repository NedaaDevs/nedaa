import { StyleSheet, View } from "react-native";

import { useSubhaInk } from "@/components/athkar/looks/subha/ink";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { SUBHA_BEADS, SUBHA_KNOTS } from "@/constants/AthkarSubha";
import { MARK_SIZE, MARK_STATE } from "@/constants/AthkarSession";
import type { PositionMark } from "@/utils/athkarSession";
import { hexAlpha } from "@/utils/hexAlpha";

/** Test ids for the knots' parts. */
export const SUBHA_KNOTS_PART = {
  KNOT: "subha-knots-knot",
  CURRENT: "subha-knots-current",
} as const;

type KnotProps = { mark: PositionMark };

const Knot = ({ mark }: KnotProps) => {
  const ink = useSubhaInk();
  const fine = mark.size === MARK_SIZE.FINE;
  const room = fine ? SUBHA_KNOTS.FINE_SHARE : 1;
  if (mark.state === MARK_STATE.CURRENT) {
    const size = SUBHA_KNOTS.CURRENT;
    return (
      <View style={[styles.knot, { flex: room }]}>
        <Box
          testID={SUBHA_KNOTS_PART.CURRENT}
          width={size}
          height={size}
          borderRadius="$pill"
          style={{ experimental_backgroundImage: ink.bead(size), boxShadow: ink.beadShadow }}
        />
      </View>
    );
  }
  const done = mark.state === MARK_STATE.DONE;
  const size = fine ? SUBHA_KNOTS.FINE : done ? SUBHA_KNOTS.DONE : SUBHA_KNOTS.REMAINING.SIZE;
  return (
    <View style={[styles.knot, { flex: room }]}>
      <Box
        testID={SUBHA_KNOTS_PART.KNOT}
        width={size}
        height={size}
        borderRadius="$pill"
        style={{
          backgroundColor: done ? ink.fg : hexAlpha(ink.fg, SUBHA_KNOTS.REMAINING.ALPHA),
        }}
      />
    </View>
  );
};

/** A session as knots on a thin string, a bead on the current one. */
export const SubhaKnots = ({ marks }: { marks: readonly PositionMark[] }) => {
  const ink = useSubhaInk();
  return (
    <HStack {...HIDDEN_FROM_READER} pointerEvents="none" height={SUBHA_KNOTS.HEIGHT} width="100%">
      <View
        style={[styles.line, { backgroundColor: hexAlpha(ink.fg, SUBHA_BEADS.LINE.OPACITY) }]}
      />
      {marks.map((mark) => (
        <Knot key={mark.id} mark={mark} />
      ))}
    </HStack>
  );
};

const styles = StyleSheet.create({
  knot: { alignItems: "center", justifyContent: "center" },
  line: {
    position: "absolute",
    start: 0,
    end: 0,
    top: (SUBHA_KNOTS.HEIGHT - SUBHA_BEADS.LINE.WIDTH) / 2,
    height: SUBHA_BEADS.LINE.WIDTH,
  },
});
