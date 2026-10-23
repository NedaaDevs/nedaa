import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { useThemeColor } from "@/components/ui/theme-color";
import { HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { OTHER_TIMING, type PrayerId } from "@/constants/Prayer";
import { RHYTHM_ARC, RHYTHM_ARC_HEIGHT, TICK_STATE } from "@/constants/Timeline";
import { useRTL } from "@/contexts/RTLContext";
import { arcPath, arcPoint } from "@/utils/rhythmArc";
import type { RhythmLine, RhythmMark, RhythmTimingId } from "@/utils/rhythm";

export const RHYTHM_ARC_PART = {
  ROOT: "rhythm-arc",
  TRACK: "rhythm-arc-track",
  DONE: "rhythm-arc-done",
  GLOW: "rhythm-arc-glow",
} as const;

/** Test id of one timing's mark. */
export const markTestId = (id: RhythmTimingId) => `rhythm-arc-mark-${id}`;

type Props = {
  marks: RhythmMark[];
  progress: RhythmLine["progress"];
  /** The prayer in focus, accented with a glow. */
  focus?: PrayerId;
  /** The prayer whose card is chosen, ringed in the accent. */
  selected?: PrayerId;
};

/** The day as an arc: a mark at each timing, filled up to now; drawing only. */
export const RhythmArc = ({ marks, progress, focus, selected }: Props) => {
  const { isRTL } = useRTL();
  const [width, setWidth] = useState(0);
  const ink = useThemeColor("$fg");
  const accent = useThemeColor("$accent");
  const glow = useThemeColor("$accentGlow");
  const raised = useThemeColor("$raised");
  const { track, done, mark, focus: lit } = RHYTHM_ARC;

  const now = progress ? progress.from + (progress.to - progress.from) * progress.fraction : 0;
  const focused = marks.find((each) => each.id === focus);

  return (
    <View
      testID={RHYTHM_ARC_PART.ROOT}
      {...HIDDEN_FROM_READER}
      style={{ height: RHYTHM_ARC_HEIGHT }}
      onLayout={({ nativeEvent }: LayoutChangeEvent) => setWidth(nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={RHYTHM_ARC_HEIGHT}>
          <Path
            testID={RHYTHM_ARC_PART.TRACK}
            d={arcPath(0, 1, width, isRTL)}
            stroke={ink}
            strokeOpacity={track.opacity}
            strokeWidth={track.stroke}
            strokeLinecap="round"
            fill="none"
          />
          {progress ? (
            <Path
              testID={RHYTHM_ARC_PART.DONE}
              d={arcPath(0, now, width, isRTL)}
              stroke={accent}
              strokeWidth={done.stroke}
              strokeLinecap="round"
              fill="none"
            />
          ) : null}
          {focused ? (
            <Circle
              testID={RHYTHM_ARC_PART.GLOW}
              {...centre(focused, width, isRTL)}
              r={lit.radius + lit.glow}
              fill={glow}
            />
          ) : null}
          {marks.map((each) => {
            const isFocus = each.id === focus;
            const radius = each.id === OTHER_TIMING.SUNRISE ? mark.quietRadius : mark.radius;
            return (
              <Circle
                key={each.id}
                testID={markTestId(each.id)}
                {...centre(each, width, isRTL)}
                r={isFocus ? lit.radius : radius}
                fill={isFocus ? accent : raised}
                stroke={isFocus ? raised : each.id === selected ? accent : ink}
                strokeWidth={isFocus ? lit.stroke : mark.stroke}
                opacity={
                  !isFocus && each.state === TICK_STATE.PASSED ? mark.pastOpacity : undefined
                }
              />
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
};

const centre = ({ share }: RhythmMark, width: number, isRTL: boolean) => {
  const { x, y } = arcPoint(share, width, isRTL);
  return { cx: x, cy: y };
};
