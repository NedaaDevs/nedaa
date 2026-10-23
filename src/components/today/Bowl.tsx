import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { Box } from "@/components/ui/box";
import { MoonGlyph } from "@/components/ui/sky-background/MoonGlyph";
import { SunGlyph } from "@/components/ui/sky-background/SunGlyph";
import { Text } from "@/components/ui/text";
import { useThemeColor } from "@/components/ui/theme-color";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { OTHER_TIMING, PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { BODY_BEHIND_TEXT, CELESTIAL_BODY, MOON_GLYPH, SUN_GLYPH } from "@/constants/Sky";
import { BOWL, TICK_STATE } from "@/constants/Timeline";
import { useRTL } from "@/contexts/RTLContext";
import { bowlPath, bowlPoint } from "@/utils/bowl";
import type { RhythmLine, RhythmMark } from "@/utils/rhythm";

export const BOWL_PART = {
  ROOT: "bowl",
  TRACK: "bowl-track",
  LIT: "bowl-lit",
  GLOW: "bowl-glow",
  SELECTED: "bowl-selected",
  BODY: "bowl-body",
  FOOT_START: "bowl-foot-start",
  FOOT_END: "bowl-foot-end",
} as const;

/** Test id of one timing's mark on the rim. */
export const bowlMarkTestId = (id: string) => `bowl-mark-${id}`;

/** The body the rim carries: the sun, or the moon in its phase. */
export type BowlBody =
  { body: typeof CELESTIAL_BODY.SUN } | { body: typeof CELESTIAL_BODY.MOON; phase: number };

type Props = {
  line: RhythmLine;
  width: number;
  height: number;
  /** The prayer whose card is chosen, ringed in the accent. */
  selected?: PrayerId;
  body: BowlBody | null;
  /** The names under the start and end feet: Fajr and Isha. */
  feet: { start: string; end: string };
};

const SUN_SCALE = BOWL.body / SUN_GLYPH.core;
const MOON_SCALE = BOWL.body / MOON_GLYPH.radius;
/** Room round the bowl for the sun's bloom, which reaches past its frame. */
const BLOOM_PAD = SUN_GLYPH.bloom * SUN_SCALE;

/** Today's bowl: the rim, its marks, the body at now and the feet's names. */
export const Bowl = ({ line, width, height, selected, body, feet }: Props) => {
  const { isRTL } = useRTL();
  const ink = useThemeColor("$fg");
  const accent = useThemeColor("$accent");
  const trail = useThemeColor("$trail");
  const { track, lit, tick, foot, focus, selected: ring } = BOWL;

  const at = (share: number) => bowlPoint(share, width, height, isRTL);
  const path = (from: number, to: number) => bowlPath(from, to, width, height, isRTL);
  const shareOf = (id: PrayerId) => line.marks.find((mark) => mark.id === id)?.share ?? 0;

  // By day the rim is lit behind the body; by night, from the body to Isha.
  const [litFrom, litTo] = line.night ? [line.now, 1] : [0, line.now];
  const ticks: RhythmMark<string>[] =
    line.night ?? line.marks.filter(({ id }) => id !== PRAYER_ID.FAJR && id !== PRAYER_ID.ISHA);
  const feetMarks = [PRAYER_ID.FAJR, PRAYER_ID.ISHA] as const;
  const now = at(line.now);

  const glowAt = (share: number) => {
    const point = at(share);
    return (
      <Circle
        testID={BOWL_PART.GLOW}
        cx={point.x}
        cy={point.y}
        r={focus.glow}
        fill={accent}
        opacity={focus.glowOpacity}
      />
    );
  };
  const dotAt = (id: string, share: number) => {
    const point = at(share);
    return (
      <Circle
        key={id}
        testID={bowlMarkTestId(id)}
        cx={point.x}
        cy={point.y}
        r={focus.radius}
        fill={accent}
      />
    );
  };

  return (
    <View testID={BOWL_PART.ROOT} {...HIDDEN_FROM_READER} style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Path
          testID={BOWL_PART.TRACK}
          d={path(0, 1)}
          stroke={ink}
          strokeOpacity={track.opacity}
          strokeWidth={track.stroke}
          strokeDasharray={[...track.dash]}
          strokeLinecap="round"
          fill="none"
        />
        {litTo > litFrom ? (
          <Path
            testID={BOWL_PART.LIT}
            d={path(litFrom, litTo)}
            stroke={trail}
            strokeWidth={lit.stroke}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
        {line.focus ? glowAt(shareOf(line.focus)) : null}
        {ticks.map(({ id, share, state }) => {
          if (id === line.focus) return dotAt(id, share);
          const { x, y, nx, ny } = at(share);
          const length = id === OTHER_TIMING.SUNRISE ? tick.quietLength : tick.length;
          return (
            <Line
              key={id}
              testID={bowlMarkTestId(id)}
              x1={x - nx * length}
              y1={y - ny * length}
              x2={x + nx * length}
              y2={y + ny * length}
              stroke={ink}
              strokeOpacity={state === TICK_STATE.FUTURE ? tick.opacity : tick.pastOpacity}
              strokeWidth={tick.stroke}
              strokeLinecap="round"
            />
          );
        })}
        {feetMarks.map((id) => {
          if (id === line.focus) return dotAt(id, shareOf(id));
          const point = at(shareOf(id));
          return (
            <Circle
              key={id}
              testID={bowlMarkTestId(id)}
              cx={point.x}
              cy={point.y}
              r={foot.radius}
              fill={ink}
              opacity={foot.opacity}
            />
          );
        })}
        {selected ? (
          <Circle
            testID={BOWL_PART.SELECTED}
            cx={at(shareOf(selected)).x}
            cy={at(shareOf(selected)).y}
            r={ring.radius}
            stroke={accent}
            strokeWidth={ring.stroke}
            fill="none"
          />
        ) : null}
      </Svg>
      {body ? (
        // The moon's halo greys light text, so it fades as behind text.
        <View
          testID={BOWL_PART.BODY}
          pointerEvents="none"
          style={[
            styles.bodyFrame,
            { opacity: body.body === CELESTIAL_BODY.MOON ? BODY_BEHIND_TEXT.opacity : 1 },
          ]}>
          {body.body === CELESTIAL_BODY.SUN ? (
            <SunGlyph
              cx={now.x + BLOOM_PAD}
              cy={now.y + BLOOM_PAD}
              width={width + 2 * BLOOM_PAD}
              height={height + 2 * BLOOM_PAD}
              scale={SUN_SCALE}
              reduced
            />
          ) : (
            <MoonGlyph
              cx={now.x + BLOOM_PAD}
              cy={now.y + BLOOM_PAD}
              phase={body.phase}
              isRTL={isRTL}
              scale={MOON_SCALE}
            />
          )}
        </View>
      ) : null}
      <FootName
        testID={BOWL_PART.FOOT_START}
        edge={{ start: 0 }}
        next={line.focus === PRAYER_ID.FAJR}>
        {feet.start}
      </FootName>
      <FootName testID={BOWL_PART.FOOT_END} edge={{ end: 0 }} next={line.focus === PRAYER_ID.ISHA}>
        {feet.end}
      </FootName>
    </View>
  );
};

type FootNameProps = {
  testID: string;
  /** The edge the name stands at. */
  edge: { start: 0 } | { end: 0 };
  next: boolean;
  children: string;
};

/** A foot's name under the horizon, in the accent when its prayer is next. */
const FootName = ({ testID, edge, next, children }: FootNameProps) => (
  <Box
    testID={testID}
    position="absolute"
    bottom={0}
    {...edge}
    // Twice the foot's inset and nudge: a short name centres on its mark.
    minWidth="$14"
    alignItems="center">
    <Text
      size="helper"
      typography="helper"
      fontWeight={next ? "600" : "500"}
      color={next ? "$accentText" : "$mutedSky"}>
      {children}
    </Text>
  </Box>
);

const styles = StyleSheet.create({
  bodyFrame: {
    position: "absolute",
    top: -BLOOM_PAD,
    bottom: -BLOOM_PAD,
    start: -BLOOM_PAD,
    end: -BLOOM_PAD,
  },
});
