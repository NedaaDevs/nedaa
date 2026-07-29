import type { ReactNode } from "react";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "tamagui";

import { Box } from "@/components/ui/box";
import { ARC_START_DEG, ARC_SWEEP_DEG, arcPath } from "@/utils/prayerArc";

type Props = {
  /** Elapsed share of the current timing window, 0–1. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  children?: ReactNode;
};

// The arc is the container for the countdown, so the content needs no card.
const PrayerProgressArc = ({ progress, size = 240, strokeWidth = 4, children }: Props) => {
  const theme = useTheme();
  const center = size / 2;
  const radius = center - strokeWidth / 2;

  const track = arcPath(center, center, radius, ARC_START_DEG, ARC_SWEEP_DEG);
  const elapsed = Math.min(Math.max(progress, 0), 1);
  // A zero-length arc still paints a round cap, which reads as progress.
  const filled =
    elapsed > 0 ? arcPath(center, center, radius, ARC_START_DEG, ARC_SWEEP_DEG * elapsed) : null;

  return (
    <Box width={size} height={size} alignItems="center" justifyContent="center">
      <Box
        position="absolute"
        top={0}
        left={0}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Svg width={size} height={size}>
          <Path
            d={track}
            stroke={theme.outline.val}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
          {filled && (
            <Path
              d={filled}
              stroke={theme.sun.val}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
            />
          )}
        </Svg>
      </Box>
      {children}
    </Box>
  );
};

export default PrayerProgressArc;
